import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { TransactionItem } from '@/components/TransactionItem';
import { formatCurrency, formatCurrencyShort } from '@/utils/format';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const categories = useStore((s) => s.categories);
  const getSafeToSpendMetrics = useStore((s) => s.getSafeToSpendMetrics);
  const getDisciplineDebt = useStore((s) => s.getDisciplineDebt);
  const getSafeToSpendStatus = useStore((s) => s.getSafeToSpendStatus);

  const metrics = getSafeToSpendMetrics();
  const disciplineDebt = getDisciplineDebt();
  const status = getSafeToSpendStatus();

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statusColor =
    status === 'safe' ? colors.success :
    status === 'warning' ? colors.warning :
    colors.danger;

  const statusBg =
    status === 'safe' ? colors.successBg :
    status === 'warning' ? colors.warningBg :
    colors.dangerBg;

  const statusText =
    status === 'safe' ? 'You are financially safe for today' :
    status === 'warning' ? 'Getting close to your limit' :
    'You are financially off-track for this month.';

  const handleAddPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-transaction');
  };

  const topPad = isWeb ? 67 : insets.top;
  const botPad = isWeb ? 34 : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: 120 + botPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appName, { color: colors.foreground }]}>Overview</Text>
          <View style={[styles.monthBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.monthText, { color: colors.mutedForeground }]}>
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Safe-to-Spend Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: statusBg, borderColor: statusColor + '30' }]}>
          <Text style={[styles.heroLabel, { color: statusColor }]}>Safe to Spend Today</Text>
          <Text style={[styles.heroAmount, { color: statusColor }]}>
            {formatCurrency(metrics.safeToSpendToday)}
          </Text>
          <Text style={[styles.heroStatus, { color: statusColor + 'CC' }]}>{statusText}</Text>
        </View>

        {/* Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: colors.muted }]}>
              <Feather name="calendar" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>
              {metrics.daysRemaining}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Days Left</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: colors.muted }]}>
              <Feather name="alert-triangle" size={16} color={disciplineDebt > 0 ? colors.danger : colors.mutedForeground} />
            </View>
            <Text style={[
              styles.metricValue,
              { color: disciplineDebt > 0 ? colors.danger : colors.foreground }
            ]}>
              {formatCurrencyShort(disciplineDebt)}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Discipline Debt</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.metricIcon, { backgroundColor: colors.muted }]}>
              <Feather name="credit-card" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>
              {formatCurrencyShort(metrics.usableBalance)}
            </Text>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Usable Balance</Text>
          </View>
        </View>

        {/* Discipline Debt Info (if any) */}
        {disciplineDebt > 0 && (
          <View style={[styles.debtBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger + '40' }]}>
            <Feather name="alert-circle" size={16} color={colors.danger} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.debtTitle, { color: colors.danger }]}>Discipline Debt</Text>
              <Text style={[styles.debtDesc, { color: colors.danger + 'BB' }]}>
                Money withdrawn from savings that has not yet been repaid through extra savings.
              </Text>
            </View>
          </View>
        )}

        {/* Recent Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent</Text>
          {transactions.length > 5 && (
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentTransactions.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No transactions yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Add your first income or expense to get started
            </Text>
          </View>
        ) : (
          recentTransactions.map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              accounts={accounts}
              categories={categories}
            />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: (isWeb ? 84 : insets.bottom + 80) + 8,
          },
        ]}
        onPress={handleAddPress}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  appName: {
    fontSize: 26,
    fontFamily: 'Inter_700Bold',
  },
  monthBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  monthText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 48,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -1,
    marginBottom: 8,
  },
  heroStatus: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  debtBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  debtTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  debtDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  seeAll: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
});
