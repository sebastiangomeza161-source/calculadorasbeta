export interface Instrument {
  ticker: string;
  name: string;
  type: 'LECAP' | 'CER';
  maturityDate: string;
  emissionDate: string;
  settlementDefault: number;
  redemptionValue?: number; // LECAP: pago al vencimiento
  cerInicial?: number;      // CER: coeficiente CER inicial
  active: boolean;
}

export function getInstrument(ticker: string): Instrument | undefined {
  // Check hardcoded instruments first
  const found = [...LECAPS, ...CER_INSTRUMENTS].find(i => i.ticker === ticker);
  if (found) return found;

  // Check custom instruments from localStorage
  try {
    const raw = localStorage.getItem('custom-instruments');
    if (raw) {
      const custom: Instrument[] = JSON.parse(raw);
      return custom.find(i => i.ticker === ticker);
    }
  } catch {}
  return undefined;
}

export function getAllTickers(): string[] {
  return [...LECAPS, ...CER_INSTRUMENTS].map(i => i.ticker);
}

export const LECAPS: Instrument[] = [
  { ticker: 'S17A6', name: 'LECAP Abr 2026', type: 'LECAP', maturityDate: '2026-04-17', emissionDate: '2025-12-15', settlementDefault: 1, redemptionValue: 110.124, active: true },
  { ticker: 'S30A6', name: 'LECAP Abr 2026 (30)', type: 'LECAP', maturityDate: '2026-04-30', emissionDate: '2025-09-30', settlementDefault: 1, redemptionValue: 127.486, active: true },
  { ticker: 'S15Y6', name: 'LECAP May 2026', type: 'LECAP', maturityDate: '2026-05-15', emissionDate: '2026-03-16', settlementDefault: 1, redemptionValue: 105.178, active: true },
  { ticker: 'S29Y6', name: 'LECAP May 2026 (29)', type: 'LECAP', maturityDate: '2026-05-29', emissionDate: '2025-05-30', settlementDefault: 1, redemptionValue: 132.044, active: true },
  { ticker: 'T30J6', name: 'LECAP Jun 2026', type: 'LECAP', maturityDate: '2026-06-30', emissionDate: '2025-01-17', settlementDefault: 1, redemptionValue: 144.896, active: true },
  { ticker: 'S31L6', name: 'LECAP Jul 2026', type: 'LECAP', maturityDate: '2026-07-31', emissionDate: '2026-01-30', settlementDefault: 1, redemptionValue: 117.678, active: true },
  { ticker: 'S31G6', name: 'LECAP Ago 2026', type: 'LECAP', maturityDate: '2026-08-31', emissionDate: '2026-08-31', settlementDefault: 1, redemptionValue: 127.065, active: true },
  { ticker: 'S30S6', name: 'LECAP Sep 2026', type: 'LECAP', maturityDate: '2026-09-30', emissionDate: '2026-03-16', settlementDefault: 1, redemptionValue: 117.536, active: true },
  { ticker: 'S30O6', name: 'LECAP Oct 2026', type: 'LECAP', maturityDate: '2026-10-30', emissionDate: '2025-10-31', settlementDefault: 1, redemptionValue: 135.280, active: true },
  { ticker: 'S30N6', name: 'LECAP Nov 2026', type: 'LECAP', maturityDate: '2026-11-30', emissionDate: '2025-12-15', settlementDefault: 1, redemptionValue: 129.885, active: true },
  { ticker: 'T15E7', name: 'LECAP Ene 2027', type: 'LECAP', maturityDate: '2027-01-15', emissionDate: '2025-01-31', settlementDefault: 1, redemptionValue: 161.104, active: true },
  { ticker: 'T30A7', name: 'LECAP Abr 2027', type: 'LECAP', maturityDate: '2027-04-30', emissionDate: '2025-10-31', settlementDefault: 1, redemptionValue: 157.344, active: true },
  { ticker: 'T31Y7', name: 'LECAP May 2027', type: 'LECAP', maturityDate: '2027-05-31', emissionDate: '2025-12-15', settlementDefault: 1, redemptionValue: 151.558, active: true },
  { ticker: 'T30J7', name: 'LECAP Jun 2027', type: 'LECAP', maturityDate: '2027-06-30', emissionDate: '2026-01-16', settlementDefault: 1, redemptionValue: 156.031, active: true },
];

export const CER_INSTRUMENTS: Instrument[] = [
  { ticker: 'X15Y6', name: 'CER May 2026', type: 'CER', maturityDate: '2026-05-15', emissionDate: '2026-02-27', settlementDefault: 1, cerInicial: 701.614, active: true },
  { ticker: 'X29Y6', name: 'CER May 2026 (29)', type: 'CER', maturityDate: '2026-05-29', emissionDate: '2025-11-28', settlementDefault: 1, cerInicial: 651.8981, active: true },
  { ticker: 'TZX26', name: 'CER Jun 2026', type: 'CER', maturityDate: '2026-06-30', emissionDate: '2024-02-01', settlementDefault: 1, cerInicial: 200.388, active: true },
  { ticker: 'X31L6', name: 'CER Jul 2026', type: 'CER', maturityDate: '2026-07-31', emissionDate: '2026-01-30', settlementDefault: 1, cerInicial: 685.5506, active: true },
  { ticker: 'X30S6', name: 'CER Sep 2026', type: 'CER', maturityDate: '2026-09-30', emissionDate: '2026-03-16', settlementDefault: 1, cerInicial: 714.9849, active: true },
  { ticker: 'TZXO6', name: 'CER Oct 2026', type: 'CER', maturityDate: '2026-10-30', emissionDate: '2024-10-31', settlementDefault: 1, cerInicial: 480.1526, active: true },
  { ticker: 'X30N6', name: 'CER Nov 2026', type: 'CER', maturityDate: '2026-11-30', emissionDate: '2025-12-15', settlementDefault: 1, cerInicial: 659.6789, active: true },
  { ticker: 'TZXD6', name: 'CER Dic 2026', type: 'CER', maturityDate: '2026-12-15', emissionDate: '2024-03-15', settlementDefault: 1, cerInicial: 271.0476, active: true },
  { ticker: 'TZXM7', name: 'CER Mar 2027', type: 'CER', maturityDate: '2027-03-31', emissionDate: '2024-05-20', settlementDefault: 1, cerInicial: 361.3176, active: true },
  { ticker: 'TZXA7', name: 'CER Abr 2027', type: 'CER', maturityDate: '2027-04-30', emissionDate: '2025-11-28', settlementDefault: 1, cerInicial: 651.8981, active: true },
  { ticker: 'TZXY7', name: 'CER May 2027', type: 'CER', maturityDate: '2027-05-31', emissionDate: '2025-12-15', settlementDefault: 1, cerInicial: 659.6789, active: true },
  { ticker: 'TZX27', name: 'CER Jun 2027', type: 'CER', maturityDate: '2027-06-30', emissionDate: '2024-02-01', settlementDefault: 1, cerInicial: 200.388, active: true },
  { ticker: 'TZXD7', name: 'CER Dic 2027', type: 'CER', maturityDate: '2027-12-15', emissionDate: '2024-03-15', settlementDefault: 1, cerInicial: 271.0476, active: true },
  { ticker: 'TZX28', name: 'CER Jun 2028', type: 'CER', maturityDate: '2028-06-30', emissionDate: '2024-02-01', settlementDefault: 1, cerInicial: 200.388, active: true },
];
