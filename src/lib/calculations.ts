/**
 * Settlement = T+1 business day (simplified: skip weekends)
 */
export function getSettlementDate(): Date {
  const today = new Date();
  const settlement = new Date(today);
  let added = 0;
  while (added < 1) {
    settlement.setDate(settlement.getDate() + 1);
    const dow = settlement.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return settlement;
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const settlement = getSettlementDate();
  const diff = target.getTime() - settlement.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * LECAP calculation — matches Excel formulas:
 *   TotalReturn = payment / price - 1
 *   TNA = totalReturn * 365 / days
 *   TEA = (payment / price) ^ (365 / days) - 1
 *   TEM = (TEA + 1) ^ (30/365) - 1
 */
export function calcLecap(
  price: number,
  maturityDate: string,
  payment: number,
  commission: number = 0
): { tna: number; tem: number; tea: number; totalReturn: number } {
  const days = daysUntil(maturityDate);
  if (days <= 0 || price <= 0 || payment <= 0) return { tna: 0, tem: 0, tea: 0, totalReturn: 0 };

  const effectivePrice = commission > 0
    ? payment / (1 + ((calcTnaRaw(price, payment, days) - commission / 100) * days / 365))
    : price;

  const totalReturn = (payment / effectivePrice) - 1;
  const tna = totalReturn * 365 / days;
  const tea = Math.pow(payment / effectivePrice, 365 / days) - 1;
  const tem = Math.pow(1 + tea, 30 / 365) - 1;

  return {
    tna: tna * 100,
    tem: tem * 100,
    tea: tea * 100,
    totalReturn: totalReturn * 100,
  };
}

function calcTnaRaw(price: number, payment: number, days: number): number {
  return (payment / price - 1) * 365 / days;
}

/**
 * BONCER calculation — matches Excel formulas:
 *   adjustedFace = 100 * lastCER / cerInicial
 *   TNA (180/360) = (POWER(adjustedFace/price, 180/days360) - 1) * 2
 *   TIR/TEA = POWER(adjustedFace/price, 365/days) - 1
 */
export function calcBoncer(
  price: number,
  maturityDate: string,
  cerInicial: number,
  lastCER: number,
  commission: number = 0
): { tna180: number; tir: number; duration: number; totalReturn: number } {
  const days = daysUntil(maturityDate);
  if (days <= 0 || price <= 0 || cerInicial <= 0 || lastCER <= 0)
    return { tna180: 0, tir: 0, duration: 0, totalReturn: 0 };

  const adjustedFace = 100 * lastCER / cerInicial;
  const effectivePrice = commission > 0
    ? adjustedFace / Math.pow(1 + commission / 200, days360(getSettlementDate(), new Date(maturityDate)) / 180)
    : price;

  const days360Val = days360(getSettlementDate(), new Date(maturityDate));
  const tna180 = (Math.pow(adjustedFace / effectivePrice, 180 / days360Val) - 1) * 2;
  const tir = Math.pow(adjustedFace / effectivePrice, 365 / days) - 1;
  const totalReturn = (adjustedFace / effectivePrice) - 1;
  const duration = days / 365;

  return {
    tna180: tna180 * 100,
    tir: tir * 100,
    duration,
    totalReturn: totalReturn * 100,
  };
}

/**
 * DAYS360 approximation (US/NASD method)
 */
function days360(start: Date, end: Date): number {
  let d1 = Math.min(start.getDate(), 30);
  let d2 = end.getDate();
  if (d1 === 30 && d2 === 31) d2 = 30;
  const m1 = start.getMonth();
  const m2 = end.getMonth();
  const y1 = start.getFullYear();
  const y2 = end.getFullYear();
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

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
