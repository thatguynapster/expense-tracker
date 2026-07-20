import React, { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  Fab,
  FabSafeFlatList,
  GroupedList,
  MonthTransitionView,
  Overline,
  useFabBottomOffset,
} from "@/components/ui";
import { TransactionItem } from "@/components/TransactionItem";
import { layout, palette, type } from "@/theme/theme";
import { useStore } from "@/store/useStore";
import { formatDateShort } from "@/utils/format";
import {
  formatMonthDisplay,
  getCurrentMonthId,
  shiftMonthId,
} from "@/utils/month";
import {
  sortAccounts,
  sortCategoriesAlphabetically,
  sortTransactions,
} from "@/utils/sorting";
import {
  activeFilterCount,
  EMPTY_TRANSACTION_FILTERS,
  filterTransactions,
  hasActiveFilters,
  type TransactionFilters,
} from "@/utils/filtering";
import type { TransactionType } from "@/lib/types";

const TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Transfer",
  adjustment: "Adjustment",
};

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const fabOffset = useFabBottomOffset();

  const accounts = sortAccounts(
    useStore((s) => s.accounts).filter((a) => !a.deletedAt),
  );
  const activeCategories = useStore((s) => s.categories).filter(
    (c) => !c.deletedAt,
  );
  const categories = sortCategoriesAlphabetically(activeCategories);
  const transactions = useStore((s) => s.transactions).filter((t) => !t.deletedAt);

  const [filters, setFilters] = useState<TransactionFilters>({
    ...EMPTY_TRANSACTION_FILTERS,
    month: getCurrentMonthId(),
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [monthDirection, setMonthDirection] = useState<1 | -1>(1);

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map((t) => t.date.slice(0, 7)));
    return Array.from(months).sort((a, b) => (a < b ? 1 : -1));
  }, [transactions]);

  const filtered = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  );
  const sorted = useMemo(() => sortTransactions(filtered), [filtered]);

  const grouped = useMemo(() => {
    const groups: { date: string; transactions: typeof sorted }[] = [];
    const seen = new Map<string, typeof sorted>();
    for (const tx of sorted) {
      const day = tx.date.split("T")[0] ?? tx.date;
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
    router.push("/add-transaction");
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
    setMonthDirection(delta >= 0 ? 1 : -1);
    setFilters((f) => ({
      ...f,
      month: shiftMonthId(f.month ?? getCurrentMonthId(), delta),
    }));
  };

  const toggleAllTime = async () => {
    await Haptics.selectionAsync();
    setFilters((f) => ({
      ...f,
      month: f.month === null ? getCurrentMonthId() : null,
    }));
  };

  const filterCount = activeFilterCount(filters);

  return (
    <View style={styles.root}>
      <MonthTransitionView
        monthKey={filters.month ?? "all"}
        direction={monthDirection}
      >
        <FabSafeFlatList
          data={grouped}
          keyExtractor={(item) => item.date}
          contentContainerStyle={{
            paddingHorizontal: layout.gutter,
            paddingTop: (isWeb ? 67 : insets.top) + layout.gapLg,
            paddingBottom: fabOffset + layout.listBottomPad,
          }}
          scrollEnabled={grouped.length > 0}
          ListHeaderComponent={
            <View>
              {/* §4.2.1: month selector lives inline in the header row — no card. */}
              <View style={styles.header}>
                <Text style={type.title}>Transactions</Text>
                <View style={styles.headerControls}>
                  <Pressable
                    style={styles.monthArrow}
                    onPress={() => goToMonth(-1)}
                  >
                    <Feather
                      name="chevron-left"
                      size={layout.iconHeader}
                      color={palette.link}
                    />
                  </Pressable>
                  <Pressable onPress={toggleAllTime} hitSlop={10}>
                    <Text style={type.bodyBold} numberOfLines={1}>
                      {filters.month
                        ? formatMonthDisplay(filters.month)
                        : "All Time"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.monthArrow}
                    onPress={() => goToMonth(1)}
                  >
                    <Feather
                      name="chevron-right"
                      size={layout.iconHeader}
                      color={palette.link}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.filterToggle}
                    onPress={toggleFilters}
                  >
                    <Feather
                      name="filter"
                      size={layout.iconHeader}
                      color={
                        filterCount > 0 ? palette.link : palette.textSecondary
                      }
                    />
                    {/* §4.2.2: active-filter count as a dot badge on the icon, not a pill. */}
                    {filterCount > 0 && (
                      <View style={styles.filterDot}>
                        <Text style={styles.filterDotText}>{filterCount}</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              </View>

              {filtersOpen && (
                <View style={styles.filterPanel}>
                  <FilterChipRow
                    label="Month"
                    value={filters.month}
                    options={availableMonths.map((m) => ({
                      id: m,
                      name: formatMonthDisplay(m),
                    }))}
                    onSelect={(month) => setFilters((f) => ({ ...f, month }))}
                  />
                  <FilterChipRow
                    label="Account"
                    value={filters.accountId}
                    options={accounts.map((a) => ({ id: a.id, name: a.name }))}
                    onSelect={(accountId) =>
                      setFilters((f) => ({ ...f, accountId }))
                    }
                  />
                  <FilterChipRow
                    label="Category"
                    value={filters.categoryId}
                    options={categories.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                    onSelect={(categoryId) =>
                      setFilters((f) => ({ ...f, categoryId }))
                    }
                  />
                  <FilterChipRow
                    label="Type"
                    value={filters.type}
                    options={(
                      ["expense", "income", "transfer", "adjustment"] as TransactionType[]
                    ).map((t) => ({
                      id: t,
                      name: TYPE_LABELS[t],
                    }))}
                    onSelect={(type) =>
                      setFilters((f) => ({
                        ...f,
                        type: type as TransactionType | null,
                      }))
                    }
                  />
                  {hasActiveFilters(filters) && (
                    <Pressable
                      onPress={clearFilters}
                      style={styles.clearFiltersBtn}
                      hitSlop={10}
                    >
                      <Text style={styles.clearFiltersText}>
                        Clear all filters
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="list" size={24} color={palette.textMuted} />
              <Text style={type.body}>
                {transactions.length === 0
                  ? "No transactions yet"
                  : "No matching transactions"}
              </Text>
              <Text style={[type.caption, styles.emptyDesc]}>
                {transactions.length === 0
                  ? "Tap the + button to record your first transaction"
                  : "Try browsing a different month or adjusting your filters"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.dateGroup}>
              <Overline style={styles.dateLabel}>
                {formatDateShort(item.date + "T00:00:00.000Z")}
              </Overline>
              <GroupedList animateItems>
                {item.transactions.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    accounts={accounts}
                    categories={categories}
                  />
                ))}
              </GroupedList>
            </View>
          )}
        />
      </MonthTransitionView>
      <Fab onPress={handleAdd} />
    </View>
  );
}

function FilterChipRow({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string | null;
  options: { id: string; name: string }[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <View style={styles.filterRow}>
      <Overline>{label}</Overline>
      <View style={styles.chipList}>
        {[{ id: null as string | null, name: "All" }, ...options].map((opt) => {
          const selected = value === opt.id;
          return (
            <Pressable
              key={opt.id ?? "all"}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onSelect(opt.id)}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {opt.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: layout.sectionGap,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthArrow: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  filterToggle: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDot: {
    position: "absolute",
    top: 4,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: layout.radiusPill,
    backgroundColor: palette.link,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDotText: {
    fontSize: type.badge.fontSize,
    fontFamily: type.badge.fontFamily,
    color: palette.canvas,
  },
  filterPanel: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: 14,
    gap: layout.gapLg,
    marginBottom: layout.sectionGap,
  },
  filterRow: {
    gap: layout.gapSm,
  },
  chipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: layout.gapSm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: layout.radiusPill,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  chipSelected: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.link,
  },
  chipText: {
    fontSize: type.caption.fontSize,
    fontFamily: type.caption.fontFamily,
    color: palette.textSecondary,
  },
  chipTextSelected: {
    fontFamily: type.bodyBold.fontFamily,
    color: palette.link,
  },
  clearFiltersBtn: {
    alignItems: "center",
    paddingTop: 4,
  },
  clearFiltersText: {
    fontSize: type.section.fontSize,
    fontFamily: type.section.fontFamily,
    color: palette.link,
  },
  dateGroup: {
    marginBottom: layout.gapLg,
  },
  dateLabel: {
    marginBottom: layout.gapSm,
  },
  empty: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.sectionGap * 2,
    marginTop: layout.sectionGap,
    gap: layout.gapSm,
  },
  emptyDesc: {
    textAlign: "center",
  },
});
