import { useState, useMemo, useCallback } from 'react';
import { LECAPS, CER_INSTRUMENTS } from '@/data/instruments';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useCER } from '@/hooks/useCER';
import { useCustomInstruments } from '@/hooks/useCustomInstruments';
import { useTheme } from '@/hooks/useTheme';
import { useMaturityOverrides } from '@/hooks/useMaturityOverrides';
import { useHolidays } from '@/hooks/useHolidays';
import { calcLecap, calcCer, daysUntil } from '@/lib/calculations';
import InstrumentTable from '@/components/InstrumentTable';
import YieldCurve from '@/components/YieldCurve';
import ProjectedCurve from '@/components/ProjectedCurve';
import AddInstrumentModal from '@/components/AddInstrumentModal';
import { useProjectedCER } from '@/hooks/useProjectedCER';
import HolidayManager from '@/components/HolidayManager';
import { Plus, Moon, Sun, Lock, Unlock, ShieldCheck, Calculator, FlaskConical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdvancedMode } from '@/hooks/useAdvancedMode';

type TabType = 'LECAP' | 'CER';

function ProjectedCurveSection() {
  const { curvePoints, inflation } = useProjectedCER();
  if (curvePoints.length === 0) return null;
  return <ProjectedCurve curvePoints={curvePoints} inflation={inflation} />;
}

export default function Index() {
  const navigate = useNavigate();
  const { getEffectiveMaturity } = useMaturityOverrides();
  const { holidayDatesSet } = useHolidays();
  const { theme, toggle: toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('LECAP');
  const [modalOpen, setModalOpen] = useState(false);
  const [manualCER, setManualCER] = useState('');
  const { isAdvanced, activate, deactivate } = useAdvancedMode();
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});

  const handleAdvancedToggle = () => {
    if (isAdvanced) {
      deactivate();
    } else {
      const pwd = prompt('Ingresá la contraseña para activar el modo avanzado:');
      if (pwd && !activate(pwd)) {
        alert('Contraseña incorrecta');
      }
    }
  };
  const { custom, addInstrument } = useCustomInstruments();

  const customTickers = custom.map(i => i.ticker);
  const { data: livePrices, isLoading } = useLivePrices(customTickers);
  const { data: cerData, isLoading: cerLoading } = useCER();

  const manualCERValue = manualCER ? parseFloat(manualCER) : null;
  const cerAvailable = cerData?.cer != null && cerData.cer > 0;
  const effectiveCER = cerAvailable ? cerData!.cer! : (manualCERValue && manualCERValue > 0 ? manualCERValue : null);
  const cerSource = cerAvailable ? 'BCRA API' : (manualCERValue && manualCERValue > 0 ? 'CER manual' : null);

  const allLecaps = [...LECAPS, ...custom.filter(i => i.type === 'LECAP')];
  const allCer = [...CER_INSTRUMENTS, ...custom.filter(i => i.type === 'CER')];
  const instruments = activeTab === 'LECAP' ? allLecaps : allCer;

  const setManualPrice = useCallback((ticker: string, value: string) => {
    setManualPrices(prev => {
      const next = { ...prev };
      if (value === '') {
        delete next[ticker];
      } else {
        next[ticker] = value;
      }
      return next;
    });
  }, []);

  const clearAllManualPrices = useCallback(() => {
    setManualPrices({});
  }, []);

  const enriched = instruments
    .map(inst => {
      const maturity = getEffectiveMaturity(inst.ticker, inst.maturityDate);
      const marketPrice = livePrices?.prices[inst.ticker]?.price ?? 0;
      const manualVal = manualPrices[inst.ticker];
      const parsedManual = manualVal ? parseFloat(manualVal) : NaN;
      const hasManualPrice = !isNaN(parsedManual) && parsedManual > 0;
      const effectivePrice = hasManualPrice ? parsedManual : marketPrice;

      return {
        ...inst,
        maturityDate: maturity,
        marketPrice: effectivePrice,
        originalMarketPrice: marketPrice,
        hasManualPrice,
        change: livePrices?.prices[inst.ticker]?.change ?? null,
      };
    })
    .sort((a, b) => daysUntil(a.maturityDate, 1, holidayDatesSet) - daysUntil(b.maturityDate, 1, holidayDatesSet));

  const curveData = useMemo(() => {
    const points: { ticker: string; price: number; days: number; duration: number; yield: number; isManual?: boolean }[] = [];

    for (const inst of enriched) {
      const days = daysUntil(inst.maturityDate, 1, holidayDatesSet);
      const duration = days / 360;

      // Always add market point if original market price exists
      const origPrice = inst.originalMarketPrice;
      if (origPrice > 0) {
        let yieldMarket = 0;
        if (activeTab === 'LECAP' && inst.redemptionValue) {
          const r = calcLecap(origPrice, inst.maturityDate, inst.redemptionValue, 1, 0, holidayDatesSet);
          if (r) yieldMarket = r.tna;
        } else if (activeTab === 'CER' && inst.cerInicial && effectiveCER) {
          const r = calcCer(origPrice, inst.maturityDate, inst.cerInicial, effectiveCER, 1, 0, holidayDatesSet);
          if (r) yieldMarket = r.tna180;
        }
        if (yieldMarket !== 0) {
          points.push({ ticker: inst.ticker, price: origPrice, days, duration, yield: yieldMarket, isManual: false });
        }
      }

      // Add manual point separately if manual price exists
      if (inst.hasManualPrice) {
        let yieldManual = 0;
        if (activeTab === 'LECAP' && inst.redemptionValue) {
          const r = calcLecap(inst.marketPrice, inst.maturityDate, inst.redemptionValue, 1, 0, holidayDatesSet);
          if (r) yieldManual = r.tna;
        } else if (activeTab === 'CER' && inst.cerInicial && effectiveCER) {
          const r = calcCer(inst.marketPrice, inst.maturityDate, inst.cerInicial, effectiveCER, 1, 0, holidayDatesSet);
          if (r) yieldManual = r.tna180;
        }
        if (yieldManual !== 0) {
          points.push({ ticker: inst.ticker, price: inst.marketPrice, days, duration, yield: yieldManual, isManual: true });
        }
      }
    }

    return points;
  }, [enriched, activeTab, effectiveCER]);

  const timestamp = livePrices?.timestamp
    ? new Date(livePrices.timestamp).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  const hasAnyManualPrice = Object.keys(manualPrices).length > 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            ADCAP
          </h1>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Argentina · LECAP & CER
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          {timestamp && <span>Última actualización: {timestamp}</span>}
          {isLoading && <span className="animate-pulse">sync</span>}
          <div className="w-2 h-2 rounded-full bg-positive animate-pulse" />
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
            title={theme === 'night' ? 'Cambiar a modo día' : 'Cambiar a modo noche'}
          >
            {theme === 'night' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {theme === 'night' ? 'Día' : 'Noche'}
          </button>
          <button
            onClick={() => navigate('/comision')}
            className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
            title="Vista Comisión"
          >
            <Calculator className="w-3 h-3" />
            Comisión
          </button>
          {isAdvanced && (
            <button
              onClick={() => navigate('/experimental')}
              className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
              title="Vista Experimental"
            >
              <FlaskConical className="w-3 h-3" />
              Experimental
            </button>
          )}
          {isAdvanced && (
            <HolidayManager />
          )}
          <button
            onClick={handleAdvancedToggle}
            className="flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
            title={isAdvanced ? 'Desactivar modo avanzado' : 'Activar modo avanzado'}
          >
            {isAdvanced ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {isAdvanced ? 'Avanzado' : 'Básico'}
          </button>
        </div>
      </header>

      {isAdvanced && (
        <div className="bg-accent/10 border-b border-accent/20 px-4 md:px-8 py-1.5 flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-accent" />
          <span className="text-[10px] text-accent font-mono uppercase tracking-wider">Modo avanzado activado</span>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5">
          {(['LECAP', 'CER'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`tab-button ${activeTab === tab ? 'tab-button-active' : 'tab-button-inactive'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Sources */}
        <div className="flex items-center gap-4 mb-4 text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
          <span>Precios: data912</span>
          {activeTab === 'CER' && cerSource && <span>· CER: {cerSource}</span>}
          <span>· Variación: precio hoy / precio ayer</span>
        </div>

        {/* CER info + manual fallback */}
        {activeTab === 'CER' && (
          <div className="space-y-3 mb-4">
            <div className="terminal-card px-4 py-3 text-xs text-muted-foreground">
              {cerData?.cer ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    CER para cálculos: <span className="text-foreground font-semibold">{cerData.cer.toFixed(4)}</span>
                    {cerData.cerDate && <span className="ml-1">({cerData.cerDate})</span>}
                  </span>
                  {cerData.latestCer && cerData.latestDate && (
                    <span>
                      CER último disponible: <span className="text-foreground">{cerData.latestCer.toFixed(4)}</span>
                      <span className="ml-1">({cerData.latestDate})</span>
                    </span>
                  )}
                  <span className="text-positive text-[10px] font-mono">Fuente: BCRA · CER a fecha de settlement (T+1)</span>
                </div>
              ) : cerLoading ? (
                <span>⏳ Cargando CER desde BCRA...</span>
              ) : (
                <span className="text-destructive">⚠ No se pudo obtener el CER desde BCRA.</span>
              )}
            </div>

            {isAdvanced && (
              <div className="terminal-card px-4 py-3 flex flex-wrap items-center gap-3">
                <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider whitespace-nowrap">
                  CER actual (manual)
                </label>
                <input
                  type="number"
                  value={manualCER}
                  onChange={(e) => setManualCER(e.target.value)}
                  placeholder="Ej: 732.60"
                  step="0.0001"
                  className="input-field w-40 text-xs py-1.5"
                />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {cerAvailable
                    ? '· Se usa CER de BCRA (este campo es respaldo)'
                    : manualCERValue && manualCERValue > 0
                      ? '· ⚠ Usando CER manual para cálculos'
                      : '· Ingresá un valor como respaldo si BCRA no responde'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Table with + button */}
        <div className="terminal-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
              {activeTab} · {enriched.length} instrumentos
            </span>
            <div className="flex items-center gap-3">
              {hasAnyManualPrice && (
                <button
                  onClick={clearAllManualPrices}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive font-mono uppercase tracking-wider transition-colors"
                  title="Borrar todos los precios manuales"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                    <path d="M22 21H7" />
                    <path d="m5 11 9 9" />
                  </svg>
                </button>
              )}
              {isAdvanced && (
                <button
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-accent font-mono uppercase tracking-wider transition-colors"
                  title="Agregar instrumento"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              )}
            </div>
          </div>
          <InstrumentTable
            instruments={enriched}
            lastCER={effectiveCER ?? undefined}
            manualPrices={manualPrices}
            onManualPriceChange={setManualPrice}
          />
        </div>

        {/* Yield Curve */}
        <YieldCurve
          data={curveData}
          yLabel={activeTab === 'LECAP' ? 'TNA' : 'TNA 180'}
        />

        {/* Projected CER curve (only in CER tab) */}
        {activeTab === 'CER' && <ProjectedCurveSection />}

      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 md:px-8 py-4 mt-12">
        <p className="text-[10px] text-muted-foreground text-center font-mono">
          Fuentes: data912.com · CER: BCRA API (T-10 días hábiles, con fallback manual)
        </p>
      </footer>

      <AddInstrumentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        type={activeTab}
        onAdd={addInstrument}
        existingTickers={customTickers}
      />
    </div>
  );
}
