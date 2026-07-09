export function formatCurrency(amount: number, currency = 'GHS'): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = currency === 'GHS' ? 'GH₵' : currency;
  if (amount < 0) return `-${prefix}${formatted}`;
  return `${prefix}${formatted}`;
}

export function formatCurrencyShort(amount: number, currency = 'GHS'): string {
  const abs = Math.abs(amount);
  const prefix = currency === 'GHS' ? 'GH₵' : currency;
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = (abs / 1_000_000).toFixed(1) + 'M';
  } else if (abs >= 1_000) {
    formatted = (abs / 1_000).toFixed(1) + 'K';
  } else {
    formatted = abs.toFixed(2);
  }
  if (amount < 0) return `-${prefix}${formatted}`;
  return `${prefix}${formatted}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
}
