export interface Instrument {
  ticker: string;
  name: string;
  type: 'LECAP' | 'BONCER';
  maturityDate: string; // ISO date
  marketPrice: number;
  nominalRate?: number; // For LECAPs (TNA or TEM)
  couponRate?: number; // For BONCER
}

export function getInstrument(ticker: string): Instrument | undefined {
  return [...LECAPS, ...BONCER].find(i => i.ticker === ticker);
}

export const LECAPS: Instrument[] = [
  { ticker: 'S17A6', name: 'LECAP Abril 2026', type: 'LECAP', maturityDate: '2026-04-17', marketPrice: 0 },
  { ticker: 'S30A6', name: 'LECAP Abril 2026 (30)', type: 'LECAP', maturityDate: '2026-04-30', marketPrice: 0 },
  { ticker: 'S15Y6', name: 'LECAP Mayo 2026', type: 'LECAP', maturityDate: '2026-05-15', marketPrice: 0 },
  { ticker: 'S29Y6', name: 'LECAP Mayo 2026 (29)', type: 'LECAP', maturityDate: '2026-05-29', marketPrice: 0 },
  { ticker: 'T30J6', name: 'LECAP Junio 2026', type: 'LECAP', maturityDate: '2026-06-30', marketPrice: 0 },
  { ticker: 'S31L6', name: 'LECAP Julio 2026', type: 'LECAP', maturityDate: '2026-07-31', marketPrice: 0 },
  { ticker: 'S31G6', name: 'LECAP Agosto 2026', type: 'LECAP', maturityDate: '2026-08-31', marketPrice: 0 },
  { ticker: 'S30S6', name: 'LECAP Septiembre 2026', type: 'LECAP', maturityDate: '2026-09-30', marketPrice: 0 },
  { ticker: 'S30O6', name: 'LECAP Octubre 2026', type: 'LECAP', maturityDate: '2026-10-30', marketPrice: 0 },
  { ticker: 'S30N6', name: 'LECAP Noviembre 2026', type: 'LECAP', maturityDate: '2026-11-30', marketPrice: 0 },
  { ticker: 'T15E7', name: 'LECAP Enero 2027', type: 'LECAP', maturityDate: '2027-01-15', marketPrice: 0 },
];

export const BONCER: Instrument[] = [
  { ticker: 'X15Y6', name: 'BONCER Mayo 2026', type: 'BONCER', maturityDate: '2026-05-15', marketPrice: 0 },
  { ticker: 'X29Y6', name: 'BONCER Mayo 2026 (29)', type: 'BONCER', maturityDate: '2026-05-29', marketPrice: 0 },
  { ticker: 'TZX26', name: 'BONCER Dic 2026', type: 'BONCER', maturityDate: '2026-12-31', marketPrice: 0 },
  { ticker: 'X31L6', name: 'BONCER Julio 2026', type: 'BONCER', maturityDate: '2026-07-31', marketPrice: 0 },
  { ticker: 'X30S6', name: 'BONCER Sep 2026', type: 'BONCER', maturityDate: '2026-09-30', marketPrice: 0 },
  { ticker: 'TZXO6', name: 'BONCER Oct 2026', type: 'BONCER', maturityDate: '2026-10-31', marketPrice: 0 },
  { ticker: 'X30N6', name: 'BONCER Nov 2026', type: 'BONCER', maturityDate: '2026-11-30', marketPrice: 0 },
  { ticker: 'TZXD6', name: 'BONCER Dic 2026 (D)', type: 'BONCER', maturityDate: '2026-12-31', marketPrice: 0 },
  { ticker: 'TZXM7', name: 'BONCER Mar 2027', type: 'BONCER', maturityDate: '2027-03-31', marketPrice: 0 },
  { ticker: 'TZXA7', name: 'BONCER Abr 2027', type: 'BONCER', maturityDate: '2027-04-30', marketPrice: 0 },
  { ticker: 'TZXY7', name: 'BONCER May 2027', type: 'BONCER', maturityDate: '2027-05-31', marketPrice: 0 },
  { ticker: 'TZX27', name: 'BONCER 2027', type: 'BONCER', maturityDate: '2027-12-31', marketPrice: 0 },
  { ticker: 'TZXD7', name: 'BONCER Dic 2027', type: 'BONCER', maturityDate: '2027-12-31', marketPrice: 0 },
  { ticker: 'TZX28', name: 'BONCER 2028', type: 'BONCER', maturityDate: '2028-12-31', marketPrice: 0 },
];
