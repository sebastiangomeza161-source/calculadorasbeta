/**
 * Financial calculations based on Excel: Calculadora_TF_y_CER
 * 
 * LECAP: zero-coupon fixed rate (known payment at maturity)
 * CER: inflation-linked (adjusted face via CER ratio)
 */

// --- Settlement ---

export function getSettlementDate(tPlus: number = 1): Date {
  const today = new Date();
  const settlement = new Date(today);
  let added = 0;
  while (added < tPlus) {
    settlement.setDate(settlement.getDate() + 1);
    const dow = settlement.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return settlement;
}

export function daysUntil(maturityDate: string, tPlus: number = 1): number {
  const target = new Date(maturityDate);
  const settlement = getSettlementDate(tPlus);
  const diff = target.getTime() - settlement.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// --- DAYS360 (US/NASD method) ---

function days360(start: Date, end: Date): number {
  let d1 = start.getDate();
  let d2 = end.getDate();
  const m1 = start.getMonth();
  const m2 = end.getMonth();
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();

  // US/NASD 30/360 convention (matches Excel DIAS360)
  if (d1 === 31) d1 = 30;
  if (d2 === 31 && d1 >= 30) d2 = 30;

  // Handle Feb end-of-month
  const lastDayFeb1 = new Date(y1, m1 + 1, 0).getDate();
  if (m1 === 1 && d1 === lastDayFeb1) {
    d1 = 30;
    const lastDayFeb2 = new Date(y2, m2 + 1, 0).getDate();
    if (m2 === 1 && d2 === lastDayFeb2) d2 = 30;
  }

  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

// --- LECAP ---

export interface LecapResult {
  days: number;
  duration: number;
  totalReturn: number;
  tna: number;
  tea: number;
  tem: number;
}

/**
 * LECAP calculation from Excel:
 *   days = maturity - settlement
 *   duration = days / 365
 *   totalReturn = redemptionValue / price - 1
 *   TNA = totalReturn * 365 / days
 *   TEA = (redemptionValue / price)^(365/days) - 1
 *   TEM = (1 + TEA)^(30/365) - 1
 *
 * With commission (TNA based):
 *   TNA_net = TNA_bruto - commission
 *   price_adj = redemptionValue / (1 + TNA_net * days / 365)
 */
export function calcLecap(
  price: number,
  maturityDate: string,
  redemptionValue: number,
  tPlus: number = 1,
  commissionTNA: number = 0
): LecapResult | null {
  const days = daysUntil(maturityDate, tPlus);
  if (days <= 0 || price <= 0 || redemptionValue <= 0) return null;

  const duration = days / 365;

  // Gross metrics
  const totalReturn = (redemptionValue / price) - 1;
  const tna = totalReturn * 365 / days;
  const tea = Math.pow(redemptionValue / price, 365 / days) - 1;
  const tem = Math.pow(1 + tea, 30 / 365) - 1;

  if (commissionTNA > 0) {
    const tnaNet = tna - commissionTNA / 100;
    const priceAdj = redemptionValue / (1 + tnaNet * days / 365);
    const trAdj = (redemptionValue / priceAdj) - 1;
    const teaAdj = Math.pow(redemptionValue / priceAdj, 365 / days) - 1;
    const temAdj = Math.pow(1 + teaAdj, 30 / 365) - 1;
    return {
      days,
      duration,
      totalReturn: trAdj * 100,
      tna: tnaNet * 100,
      tea: teaAdj * 100,
      tem: temAdj * 100,
    };
  }

  return {
    days,
    duration,
    totalReturn: totalReturn * 100,
    tna: tna * 100,
    tea: tea * 100,
    tem: tem * 100,
  };
}

// --- CER ---

export interface CerResult {
  days: number;
  duration: number;
  adjustedFace: number;
  totalReturn: number;
  tna180: number;
  tir: number;
}

/**
 * CER calculation from Excel:
 *   adjustedFace = 100 * lastCER / cerInicial
 *   days360Val = DAYS360(settlement, maturity)
 *   TNA(180/360) = (POWER(adjustedFace/price, 180/days360Val) - 1) * 2
 *   TIR = POWER(adjustedFace/price, 365/days) - 1
 *
 * With commission (TNA based):
 *   price_adj = adjustedFace / POWER(1 + commission/200, days360Val/180)
 */
export function calcCer(
  price: number,
  maturityDate: string,
  cerInicial: number,
  lastCER: number,
  tPlus: number = 1,
  commissionTNA: number = 0
): CerResult | null {
  const days = daysUntil(maturityDate, tPlus);
  if (days <= 0 || price <= 0 || cerInicial <= 0 || lastCER <= 0) return null;

  const adjustedFace = 100 * lastCER / cerInicial;
  const settlement = getSettlementDate(tPlus);
  const days360Val = days360(settlement, new Date(maturityDate));
  const duration = days360Val / 360;

  let effectivePrice = price;
  if (commissionTNA > 0) {
    effectivePrice = adjustedFace / Math.pow(1 + commissionTNA / 200, days360Val / 180);
  }

  // Excel: =((POWER((100*Q/P/$C-1)+1, 180/DIAS360(tradeDate, maturity))-1)*360/180)*100
  // ratio = 100 * lastCER / (cerInicial * price) = adjustedFace / price
  const ratio = adjustedFace / effectivePrice;
  const tna180 = days360Val > 0
    ? (Math.pow(ratio, 180 / days360Val) - 1) * 2 * 100
    : 0;
  const tir = Math.pow(ratio, 365 / days) - 1;
  const totalReturn = (ratio - 1);

  return {
    days,
    duration,
    adjustedFace,
    totalReturn: totalReturn * 100,
    tna180: tna180 * 100,
    tir: tir * 100,
  };
}

// --- Formatting ---

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
