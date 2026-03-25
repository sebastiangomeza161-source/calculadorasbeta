export interface Instrument {
  ticker: string;
  name: string;
  type: 'LECAP' | 'BONCER';
  maturityDate: string;
  emissionDate: string;
  marketPrice: number;
  payment?: number; // LECAP: known payment at maturity
  cerInicial?: number; // BONCER: initial CER coefficient
}

export function getInstrument(ticker: string): Instrument | undefined {
  return [...LECAPS, ...BONCER].find(i => i.ticker === ticker);
}

export const LECAPS: Instrument[] = [
  { ticker: 'S17A6', name: 'LECAP Abr 2026', type: 'LECAP', maturityDate: '2026-04-17', emissionDate: '2025-12-15', marketPrice: 0, payment: 110.124 },
  { ticker: 'S30A6', name: 'LECAP Abr 2026 (30)', type: 'LECAP', maturityDate: '2026-04-30', emissionDate: '2025-09-30', marketPrice: 0, payment: 127.486 },
  { ticker: 'S15Y6', name: 'LECAP May 2026', type: 'LECAP', maturityDate: '2026-05-15', emissionDate: '2026-03-16', marketPrice: 0, payment: 105.178 },
  { ticker: 'S29Y6', name: 'LECAP May 2026 (29)', type: 'LECAP', maturityDate: '2026-05-29', emissionDate: '2025-05-30', marketPrice: 0, payment: 132.044 },
  { ticker: 'T30J6', name: 'LECAP Jun 2026', type: 'LECAP', maturityDate: '2026-06-30', emissionDate: '2025-01-17', marketPrice: 0, payment: 144.896 },
  { ticker: 'S31L6', name: 'LECAP Jul 2026', type: 'LECAP', maturityDate: '2026-07-31', emissionDate: '2026-01-30', marketPrice: 0, payment: 117.678 },
  { ticker: 'S31G6', name: 'LECAP Ago 2026', type: 'LECAP', maturityDate: '2026-08-31', emissionDate: '2026-08-31', marketPrice: 0, payment: 127.065 },
  { ticker: 'S30S6', name: 'LECAP Sep 2026', type: 'LECAP', maturityDate: '2026-09-30', emissionDate: '2026-03-16', marketPrice: 0, payment: 117.536 },
  { ticker: 'S30O6', name: 'LECAP Oct 2026', type: 'LECAP', maturityDate: '2026-10-30', emissionDate: '2025-10-31', marketPrice: 0, payment: 135.28 },
  { ticker: 'S30N6', name: 'LECAP Nov 2026', type: 'LECAP', maturityDate: '2026-11-30', emissionDate: '2025-12-15', marketPrice: 0, payment: 129.885 },
  { ticker: 'T15E7', name: 'LECAP Ene 2027', type: 'LECAP', maturityDate: '2027-01-15', emissionDate: '2025-01-31', marketPrice: 0, payment: 161.104 },
];

export const BONCER: Instrument[] = [
  { ticker: 'X15Y6', name: 'BONCER May 2026', type: 'BONCER', maturityDate: '2026-05-15', emissionDate: '2026-02-27', marketPrice: 0, cerInicial: 701.614 },
  { ticker: 'X29Y6', name: 'BONCER May 2026 (29)', type: 'BONCER', maturityDate: '2026-05-29', emissionDate: '2025-11-28', marketPrice: 0, cerInicial: 651.898 },
  { ticker: 'TZX26', name: 'BONCER Jun 2026', type: 'BONCER', maturityDate: '2026-06-30', emissionDate: '2024-02-01', marketPrice: 0, cerInicial: 200.388 },
  { ticker: 'X31L6', name: 'BONCER Jul 2026', type: 'BONCER', maturityDate: '2026-07-31', emissionDate: '2026-01-30', marketPrice: 0, cerInicial: 685.551 },
  { ticker: 'X30S6', name: 'BONCER Sep 2026', type: 'BONCER', maturityDate: '2026-09-30', emissionDate: '2026-03-16', marketPrice: 0, cerInicial: 714.985 },
  { ticker: 'TZXO6', name: 'BONCER Oct 2026', type: 'BONCER', maturityDate: '2026-10-30', emissionDate: '2024-10-31', marketPrice: 0, cerInicial: 480.153 },
  { ticker: 'X30N6', name: 'BONCER Nov 2026', type: 'BONCER', maturityDate: '2026-11-30', emissionDate: '2025-12-15', marketPrice: 0, cerInicial: 659.679 },
  { ticker: 'TZXD6', name: 'BONCER Dic 2026', type: 'BONCER', maturityDate: '2026-12-15', emissionDate: '2024-03-15', marketPrice: 0, cerInicial: 271.048 },
  { ticker: 'TZXM7', name: 'BONCER Mar 2027', type: 'BONCER', maturityDate: '2027-03-31', emissionDate: '2024-05-20', marketPrice: 0, cerInicial: 361.318 },
  { ticker: 'TZXA7', name: 'BONCER Abr 2027', type: 'BONCER', maturityDate: '2027-04-30', emissionDate: '2025-11-28', marketPrice: 0, cerInicial: 651.898 },
  { ticker: 'TZXY7', name: 'BONCER May 2027', type: 'BONCER', maturityDate: '2027-05-31', emissionDate: '2025-12-15', marketPrice: 0, cerInicial: 659.679 },
  { ticker: 'TZX27', name: 'BONCER Jun 2027', type: 'BONCER', maturityDate: '2027-06-30', emissionDate: '2024-02-01', marketPrice: 0, cerInicial: 200.388 },
  { ticker: 'TZXD7', name: 'BONCER Dic 2027', type: 'BONCER', maturityDate: '2027-12-15', emissionDate: '2024-03-15', marketPrice: 0, cerInicial: 271.048 },
  { ticker: 'TZX28', name: 'BONCER Jun 2028', type: 'BONCER', maturityDate: '2028-06-30', emissionDate: '2024-02-01', marketPrice: 0, cerInicial: 200.388 },
];
