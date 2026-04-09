import { useState, useCallback } from 'react';
import { useHolidays } from '@/hooks/useHolidays';
import { Calendar, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

function parseDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // ISO: YYYY-MM-DD
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return validateAndFormat(parseInt(y), parseInt(mo), parseInt(d));
  }

  // Ambiguous: A/B/YYYY or A/B/YY — detect DD/MM vs MM/DD
  m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const a = parseInt(m[1]);
    const b = parseInt(m[2]);
    let year = parseInt(m[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;

    let day: number, month: number;
    if (a > 12 && b <= 12) {
      // a can't be month → DD/MM
      day = a; month = b;
    } else if (b > 12 && a <= 12) {
      // b can't be month → MM/DD
      day = b; month = a;
    } else {
      // Both ≤12: default DD/MM (Argentine convention)
      day = a; month = b;
    }
    return validateAndFormat(year, month, day);
  }

  return null;
}

function validateAndFormat(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function HolidayManager() {
  const { holidays, addHolidays, removeHoliday, clearAll, isLoading } = useHolidays();
  const [textInput, setTextInput] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleImport = useCallback(() => {
    const lines = textInput.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    const parsed: { date: string; label: string }[] = [];
    const errors: string[] = [];

    for (const line of lines) {
      const date = parseDateInput(line);
      if (date) {
        parsed.push({ date, label: '' });
      } else {
        errors.push(line);
      }
    }

    if (parsed.length > 0) {
      addHolidays.mutate(parsed, {
        onSuccess: () => {
          setImportStatus(`✓ ${parsed.length} feriado(s) importados${errors.length > 0 ? ` · ${errors.length} no reconocidos` : ''}`);
          setTextInput('');
          setTimeout(() => setImportStatus(null), 4000);
        },
        onError: () => {
          setImportStatus('⚠ Error al guardar');
          setTimeout(() => setImportStatus(null), 4000);
        },
      });
    } else {
      setImportStatus('⚠ No se reconoció ninguna fecha válida');
      setTimeout(() => setImportStatus(null), 4000);
    }
  }, [textInput, addHolidays]);

  const formatDisplay = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-ring transition-colors text-[10px] uppercase tracking-wider font-mono"
          title="Gestionar feriados globales"
        >
          <Calendar className="w-3 h-3" />
          Feriados{holidays.length > 0 ? ` (${holidays.length})` : ''}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono">
            <Calendar className="w-4 h-4 text-accent" />
            Feriados globales · {holidays.length} cargados
          </DialogTitle>
          <DialogDescription className="text-[10px] font-mono text-muted-foreground">
            Los feriados aplican a todos los cálculos de días hábiles: settlement, CER T-10, LECAP y cualquier instrumento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Input area */}
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
              Pegar fechas (dd/mm/aa, dd/mm/aaaa, yyyy-mm-dd) · una por línea o separadas por coma
            </label>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder={`01/01/26\n24/03/26\n02/04/26\n01/05/26`}
              rows={4}
              className="w-full bg-transparent border border-border/40 rounded px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent/60 transition-colors resize-none"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={!textInput.trim() || addHolidays.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-ring transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-3 h-3" />
                Importar
              </button>
              {importStatus && (
                <span className="text-[10px] font-mono text-accent">{importStatus}</span>
              )}
            </div>
          </div>

          {/* Holiday list */}
          {holidays.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  Feriados cargados
                </span>
                <button
                  onClick={() => clearAll.mutate()}
                  className="text-[10px] text-muted-foreground hover:text-destructive font-mono uppercase tracking-wider transition-colors"
                >
                  Limpiar todos
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto border border-border/30 rounded p-2">
                <div className="flex flex-wrap gap-2">
                  {holidays.map(h => (
                    <div
                      key={h.id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded border border-border/30 bg-card text-xs font-mono text-muted-foreground"
                    >
                      <span>{formatDisplay(h.date)}</span>
                      <button
                        onClick={() => removeHoliday.mutate(h.id)}
                        className="text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isLoading && (
            <span className="text-[10px] text-muted-foreground font-mono animate-pulse">Cargando feriados...</span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
