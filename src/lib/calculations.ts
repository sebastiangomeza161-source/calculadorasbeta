export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function calcLecap(price: number, maturityDate: string, commission: number = 0): {
  tna: number;
  tem: number;
  tea: number;
  netReturn: number;
} {
  const days = daysUntil(maturityDate);
  if (days <= 0 || price <= 0) return { tna: 0, tem: 0, tea: 0, netReturn: 0 };

  const faceValue = 100;
  const effectivePrice = price * (1 + commission / 100);
  const grossReturn = (faceValue / effectivePrice) - 1;
  const tna = grossReturn * (365 / days);
  const tem = Math.pow(1 + grossReturn, 30 / days) - 1;
  const tea = Math.pow(1 + grossReturn, 365 / days) - 1;

  return {
    tna: tna * 100,
    tem: tem * 100,
    tea: tea * 100,
    netReturn: grossReturn * 100,
  };
}

export function calcCer(price: number, maturityDate: string, commission: number = 0): {
  tna: number;
  tea: number;
  netReturn: number;
} {
  const days = daysUntil(maturityDate);
  if (days <= 0 || price <= 0) return { tna: 0, tea: 0, netReturn: 0 };

  const faceValue = 100;
  const effectivePrice = price * (1 + commission / 100);
  const grossReturn = (faceValue / effectivePrice) - 1;
  const tna = grossReturn * (365 / days);
  const tea = Math.pow(1 + grossReturn, 365 / days) - 1;

  return {
    tna: tna * 100,
    tea: tea * 100,
    netReturn: grossReturn * 100,
  };
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
