export function getCurrentMonthId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getDaysRemainingInMonth(fromDate?: Date): number {
  const now = fromDate ?? new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  return lastDay - today + 1;
}

export function getTotalDaysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

export function formatMonthDisplay(monthId: string): string {
  const [year, month] = monthId.split('-');
  const date = new Date(parseInt(year!), parseInt(month!) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Shifts a `YYYY-MM` id by `delta` months (negative to go back), handling year rollover. */
export function shiftMonthId(monthId: string, delta: number): string {
  const [year, month] = monthId.split('-').map(Number);
  const date = new Date(year!, month! - 1 + delta, 1);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
