export const CURRENCY_SYMBOL = 'GH₵';

/**
 * Digits only, no currency prefix and no sign — 1234.5 → "1,234.50".
 * The restyle components (AmountText, HeroCard) render sign and symbol
 * themselves at their own sizes/colors, so they need the bare number.
 */
export function formatAmount(amount: number): string {
  return Math.abs(amount).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

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
