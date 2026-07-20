import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  AmountText,
  Fab,
  FabSafeScrollView,
  GroupedList,
  HeroCard,
  Overline,
  Row,
  SectionHeader,
  useFabBottomOffset,
  type HeroFamily,
} from '@/components/ui';
import { TransactionItem } from '@/components/TransactionItem';
import { layout, palette, type } from '@/theme/theme';
import { useStore } from '@/store/useStore';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { calculateDisciplineDebt, calculateSafeToSpendToday, getLoansSummary, getSafeToSpendStatus } from '@/utils/calculations';
import { sortTransactions } from '@/utils/sorting';
import type { SafeToSpendStatus } from '@/lib/types';

const HERO_FAMILY: Record<SafeToSpendStatus, HeroFamily> = {
  safe: 'positive',
  warning: 'caution',
  danger: 'alert',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const fabOffset = useFabBottomOffset();

  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions).filter((t) => !t.deletedAt);
  const categories = useStore((s) => s.categories);
  const loans = useStore((s) => s.loans);
  const loanPayments = useStore((s) => s.loanPayments);
  const disciplineState = useStore((s) => s.disciplineState);

  const recentTransactions = sortTransactions(transactions).slice(0, 5);

  // Plain computation, not useMemo: React Compiler (experiments.reactCompiler
  // in app.json) can't prove `transactions` is never mutated by the
  // calculateSafeToSpendToday/etc. calls below and bails on preserving a
  // manual memo here — and at ≤5 items (recentTransactions is already
  // sliced), recomputing this grouping every render costs nothing anyway.
  const recentGroups: { date: string; transactions: typeof recentTransactions }[] = [];
  {
    const seen = new Map<string, typeof recentTransactions>();
    for (const tx of recentTransactions) {
      const day = tx.date.split('T')[0] ?? tx.date;
      if (!seen.has(day)) {
        seen.set(day, []);
        recentGroups.push({ date: day, transactions: seen.get(day)! });
      }
      seen.get(day)!.push(tx);
    }
  }

  // Called directly against subscribed state (not routed through the store's
  // getSafeToSpend*/getDisciplineDebt methods) so editing disciplineState in
  // Settings — e.g. the Daily Budget — re-renders this screen immediately.
  // Those store methods are stable function references; selecting one alone
  // doesn't subscribe to the state it reads via get() internally, so this
  // tab (which stays mounted across tab switches) would otherwise only pick
  // up the change on its next unrelated re-render or a full app restart.
  const metrics = calculateSafeToSpendToday(accounts, transactions, disciplineState.customDailyBudget);
  const disciplineDebt = calculateDisciplineDebt(disciplineState);
  const status = getSafeToSpendStatus(metrics.safeToSpendToday, disciplineState.safeToSpendWarningThreshold);
  const loansSummary = getLoansSummary(loans, loanPayments);

  // §3.3 "say it once": Days Left and Usable Balance live here, not in cards.
  const heroMeta = `${metrics.daysRemaining} days left  ·  ${formatCurrency(metrics.usableBalance)} usable`;
  const heroBudgetMeta = `${formatCurrency(metrics.dailyBudget)} budget  ·  ${formatCurrency(metrics.spentToday)} spent today`;
  const heroWarningNote = metrics.budgetUnsustainable
    ? "This budget won't last the rest of the month at your current balance."
    : undefined;

  const handleAddPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-transaction');
  };

  return (
    <View style={styles.root}>
      <FabSafeScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingTop: (isWeb ? 67 : insets.top) + layout.gapLg,
          paddingBottom: fabOffset + layout.listBottomPad,
        }}
      >
        {/* §4.1.1: title left, month pill right. */}
        <View style={styles.header}>
          <Text style={type.title}>Overview</Text>
          <View style={styles.monthPill}>
            <Text style={type.caption}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <HeroCard
          label="Safe to spend today"
          amount={metrics.safeToSpendToday}
          family={HERO_FAMILY[status]}
          meta={heroMeta}
          secondaryMeta={heroBudgetMeta}
          warningNote={heroWarningNote}
        />

        {/* §4.1.3: discipline debt is a quiet row at zero, a caution card when owed. */}
        {disciplineDebt === 0 ? (
          <GroupedList style={styles.section}>
            <View style={styles.debtZeroRow}>
              <Text style={type.caption}>Discipline debt</Text>
              <AmountText amount={0} kind="transfer" />
            </View>
          </GroupedList>
        ) : (
          <View style={[styles.section, styles.debtCard]}>
            <Text style={[type.caption, styles.debtTitle]}>Discipline debt</Text>
            <AmountText amount={disciplineDebt} size="title" color={palette.caution} style={styles.debtAmount} />
            <Text style={[type.caption, styles.debtDesc]}>
              Money withdrawn from savings that has not yet been repaid through extra savings.
            </Text>
          </View>
        )}

        {loansSummary.borrowerCount > 0 && (
          <GroupedList style={styles.section}>
            <Row
              icon="dollar-sign"
              iconTint={
                loansSummary.overdueCount > 0
                  ? palette.alert
                  : loansSummary.dueTodayCount > 0
                    ? palette.caution
                    : palette.textSecondary
              }
              title={`You are owed ${formatCurrency(loansSummary.totalOutstanding)}`}
              subtitle={
                <>
                  {`Across ${loansSummary.borrowerCount} ${loansSummary.borrowerCount === 1 ? 'person' : 'people'}`}
                  {loansSummary.overdueCount > 0 && (
                    <Text style={{ color: palette.alert }}>{` · ${loansSummary.overdueCount} overdue`}</Text>
                  )}
                  {loansSummary.dueTodayCount > 0 && (
                    <Text style={{ color: palette.caution }}>{` · ${loansSummary.dueTodayCount} due today`}</Text>
                  )}
                </>
              }
              chevron
              onPress={() => router.push('/(tabs)/loans')}
            />
          </GroupedList>
        )}

        <View style={[styles.section, styles.recentHeader]}>
          <SectionHeader
            label="Recent"
            actionLabel={transactions.length > 5 ? 'See all' : undefined}
            onAction={() => router.push('/(tabs)/transactions')}
          />
        </View>

        {recentTransactions.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="inbox" size={24} color={palette.textMuted} />
            <Text style={type.body}>No transactions yet</Text>
            <Text style={[type.caption, styles.emptyDesc]}>
              Add your first income or expense to get started
            </Text>
          </View>
        ) : (
          recentGroups.map((group) => (
            <View key={group.date} style={styles.dateGroup}>
              <Overline style={styles.dateLabel}>
                {formatDateShort(group.date + 'T00:00:00.000Z')}
              </Overline>
              <GroupedList animateItems>
                {group.transactions.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    accounts={accounts}
                    categories={categories}
                  />
                ))}
              </GroupedList>
            </View>
          ))
        )}
      </FabSafeScrollView>

      <Fab onPress={handleAddPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: layout.sectionGap,
  },
  monthPill: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusPill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  section: {
    marginTop: layout.sectionGap,
  },
  debtZeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.rowHeight,
    paddingVertical: layout.rowPaddingV,
  },
  debtCard: {
    backgroundColor: palette.cautionBg,
    borderWidth: 1,
    borderColor: palette.cautionBorder,
    borderRadius: layout.radiusContainer,
    padding: 14,
  },
  debtTitle: {
    color: palette.caution,
  },
  debtAmount: {
    textAlign: 'left',
    marginTop: 4,
  },
  debtDesc: {
    color: palette.caution,
    marginTop: 6,
  },
  recentHeader: {
    marginBottom: layout.gapMd,
  },
  dateGroup: {
    marginBottom: layout.gapLg,
  },
  dateLabel: {
    marginBottom: layout.gapSm,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.sectionGap * 2,
    gap: layout.gapSm,
  },
  emptyDesc: {
    textAlign: 'center',
  },
});
