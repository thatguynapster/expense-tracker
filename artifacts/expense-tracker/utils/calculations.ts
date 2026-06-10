import type { Account, DisciplineState, SafeToSpendMetrics, SafeToSpendStatus } from '@/lib/types';
import { getDaysRemainingInMonth } from './month';

export function calculateSafeToSpendToday(
  accounts: Account[],
  currentDate?: Date
): SafeToSpendMetrics {
  const usableBalance = accounts
    .filter((a) => a.type === 'spendable')
    .reduce((sum, a) => sum + a.balance, 0);

  const daysRemaining = getDaysRemainingInMonth(currentDate);

  const safeToSpendToday = daysRemaining > 0 ? usableBalance / daysRemaining : 0;

  return { usableBalance, daysRemaining, safeToSpendToday };
}

export function calculateDisciplineDebt(state: DisciplineState): number {
  return Math.max(0, state.totalWithdrawnFromSavings - state.totalExtraSavings);
}

const WARNING_THRESHOLD = 50;

export function getSafeToSpendStatus(safeToSpendToday: number): SafeToSpendStatus {
  if (safeToSpendToday <= 0) return 'danger';
  if (safeToSpendToday < WARNING_THRESHOLD) return 'warning';
  return 'safe';
}
