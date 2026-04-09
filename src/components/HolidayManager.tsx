import { useState, useCallback } from 'react';
import { useHolidays } from '@/hooks/useHolidays';
import { Calendar, Trash2, Upload, X } from 'lucide-react';

function parseDateInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YYYY-MM-DD
  let m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YY
  m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const [, d, mo, yy] = m;
    const year = parseInt(yy) < 50 ? `20${yy}` : `19${yy}`;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
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
    <div className="terminal-card overflow-hidden">
      <div className="px-4 py-2 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-accent" />
          <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
            Feriados · {holidays.length} cargados
          </span>
        </div>
        {holidays.length > 0 && (
          <button
            onClick={() => clearAll.mutate()}
            className="text-[10px] text-muted-foreground hover:text-destructive font-mono uppercase tracking-wider transition-colors"
            title="Limpiar todos"
          >
            Limpiar todos
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
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
          <div className="max-h-[200px] overflow-y-auto border-t border-border/30 pt-3">
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
        )}

        {isLoading && (
          <span className="text-[10px] text-muted-foreground font-mono animate-pulse">Cargando feriados...</span>
        )}
      </div>
    </div>
  );
}
