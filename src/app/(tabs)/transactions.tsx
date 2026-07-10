import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { TransactionItem } from '@/components/TransactionItem';
import { formatDate } from '@/utils/format';
import { formatMonthDisplay, getCurrentMonthId, shiftMonthId } from '@/utils/month';
import { sortAccounts, sortCategoriesAlphabetically, sortTransactions } from '@/utils/sorting';
import {
  activeFilterCount,
  EMPTY_TRANSACTION_FILTERS,
  filterTransactions,
  hasActiveFilters,
  type TransactionFilters,
} from '@/utils/filtering';
import type { TransactionType } from '@/lib/types';

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const accounts = sortAccounts(useStore((s) => s.accounts).filter((a) => !a.deletedAt));
  const activeCategories = useStore((s) => s.categories).filter((c) => !c.deletedAt);
  const categories = sortCategoriesAlphabetically(activeCategories);
  const transactions = useStore((s) => s.transactions);

  const [filters, setFilters] = useState<TransactionFilters>({
    ...EMPTY_TRANSACTION_FILTERS,
    month: getCurrentMonthId(),
  });
  const [filtersOpen, setFiltersOpen] = useState(false);

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  const filtered = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);
  const sorted = useMemo(() => sortTransactions(filtered), [filtered]);

  const grouped = useMemo(() => {
    const groups: { date: string; transactions: typeof sorted }[] = [];
    const seen = new Map<string, typeof sorted>();
    for (const tx of sorted) {
      const day = tx.date.split('T')[0] ?? tx.date;
      if (!seen.has(day)) {
        seen.set(day, []);
        groups.push({ date: day, transactions: seen.get(day)! });
      }
      seen.get(day)!.push(tx);
    }
    return groups;
  }, [sorted]);

  const handleAdd = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-transaction');
  };

  const toggleFilters = async () => {
    await Haptics.selectionAsync();
    setFiltersOpen((v) => !v);
  };

  const clearFilters = async () => {
    await Haptics.selectionAsync();
    setFilters(EMPTY_TRANSACTION_FILTERS);
  };

  const goToMonth = async (delta: number) => {
    await Haptics.selectionAsync();
    setFilters((f) => ({ ...f, month: shiftMonthId(f.month ?? getCurrentMonthId(), delta) }));
  };

  const toggleAllTime = async () => {
    await Haptics.selectionAsync();
    setFilters((f) => ({ ...f, month: f.month === null ? getCurrentMonthId() : null }));
  };

  const filterCount = activeFilterCount(filters);

  const FilterChipRow = ({
    label,
    value,
    options,
    onSelect,
  }: {
    label: string;
    value: string | null;
    options: { id: string; name: string }[];
    onSelect: (id: string | null) => void;
  }) => (
    <View style={styles.filterRow}>
      <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.chipList}>
        <TouchableOpacity
          style={[
            styles.chip,
            { backgroundColor: value === null ? colors.primary : colors.muted, borderColor: value === null ? colors.primary : colors.border },
          ]}
          onPress={() => onSelect(null)}
        >
          <Text style={[styles.chipText, { color: value === null ? colors.primaryForeground : colors.foreground }]}>All</Text>
        </TouchableOpacity>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.chip,
              { backgroundColor: value === opt.id ? colors.primary : colors.muted, borderColor: value === opt.id ? colors.primary : colors.border },
            ]}
            onPress={() => onSelect(opt.id)}
          >
            <Text style={[styles.chipText, { color: value === opt.id ? colors.primaryForeground : colors.foreground }]}>{opt.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: isWeb ? 67 + 16 : insets.top + 16,
            paddingBottom: isWeb ? 84 + 34 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={grouped.length > 0}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Transactions</Text>
              <TouchableOpacity
                style={[
                  styles.filterToggle,
                  { backgroundColor: filterCount > 0 ? colors.primary : colors.muted },
                ]}
                onPress={toggleFilters}
              >
                <Feather name="filter" size={14} color={filterCount > 0 ? colors.primaryForeground : colors.foreground} />
                {filterCount > 0 && (
                  <Text style={[styles.filterToggleText, { color: colors.primaryForeground }]}>{filterCount}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.monthSwitcher, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => goToMonth(-1)} style={styles.monthArrow}>
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleAllTime} style={styles.monthLabelBtn}>
                <Text style={[styles.monthLabelText, { color: colors.foreground }]}>
                  {filters.month ? formatMonthDisplay(filters.month) : 'All Time'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => goToMonth(1)} style={styles.monthArrow}>
                <Feather name="chevron-right" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {filtersOpen && (
              <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <FilterChipRow
                  label="Month"
                  value={filters.month}
                  options={availableMonths.map((m) => ({ id: m, name: formatMonthDisplay(m) }))}
                  onSelect={(month) => setFilters((f) => ({ ...f, month }))}
                />
                <FilterChipRow
                  label="Account"
                  value={filters.accountId}
                  options={accounts.map((a) => ({ id: a.id, name: a.name }))}
                  onSelect={(accountId) => setFilters((f) => ({ ...f, accountId }))}
                />
                <FilterChipRow
                  label="Category"
                  value={filters.categoryId}
                  options={categories.map((c) => ({ id: c.id, name: c.name }))}
                  onSelect={(categoryId) => setFilters((f) => ({ ...f, categoryId }))}
                />
                <FilterChipRow
                  label="Type"
                  value={filters.type}
                  options={(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => ({ id: t, name: TYPE_LABELS[t] }))}
                  onSelect={(type) => setFilters((f) => ({ ...f, type: type as TransactionType | null }))}
                />
                {hasActiveFilters(filters) && (
                  <TouchableOpacity onPress={clearFilters} style={styles.clearFiltersBtn}>
                    <Text style={[styles.clearFiltersText, { color: colors.danger }]}>Clear all filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="list" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {transactions.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              {transactions.length === 0
                ? 'Tap the + button to record your first transaction'
                : 'Try browsing a different month or adjusting your filters'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
              {formatDate(item.date + 'T00:00:00.000Z')}
            </Text>
            {item.transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                categories={categories}
              />
            ))}
          </View>
        )}
      />
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: (isWeb ? 84 : insets.bottom + 80) + 8,
          },
        ]}
        onPress={handleAdd}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  filterToggleText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    marginBottom: 20,
  },
  monthArrow: { padding: 12 },
  monthLabelBtn: { flex: 1, alignItems: 'center' },
  monthLabelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  filterPanel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 14,
  },
  filterRow: { gap: 8 },
  filterLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  clearFiltersBtn: { alignItems: 'center', paddingTop: 4 },
  clearFiltersText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  dateLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
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
