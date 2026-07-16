import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  AmountText,
  FabSafeScrollView,
  MonthTransitionView,
  Overline,
  PressFeedback,
  ScreenHeader,
} from "@/components/ui";
import { layout, palette, type } from "@/theme/theme";
import { useStore } from "@/store/useStore";
import { CURRENCY_SYMBOL } from "@/utils/format";
import { formatMonthDisplay } from "@/utils/month";

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const setBudget = useStore((s) => s.setBudget);
  const getMonthSummary = useStore((s) => s.getMonthSummary);

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [monthDirection, setMonthDirection] = useState<1 | -1>(1);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editingValue, setEditingValue] = useState("");

  const month = monthKey(monthDate);
  const summary = getMonthSummary(month);

  const goToMonth = async (delta: number) => {
    await Haptics.selectionAsync();
    setMonthDirection(delta >= 0 ? 1 : -1);
    setMonthDate((d) => addMonths(d, delta));
  };

  const startEdit = (categoryId: string, currentPlanned: number) => {
    setEditingCategoryId(categoryId);
    setEditingValue(currentPlanned > 0 ? String(currentPlanned) : "");
  };

  const saveEdit = async () => {
    if (!editingCategoryId) return;
    const amount = parseFloat(editingValue) || 0;
    await setBudget(editingCategoryId, month, amount);
    await Haptics.selectionAsync();
    setEditingCategoryId(null);
    setEditingValue("");
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Budget"
        paddingTop={isWeb ? 67 : insets.top + 10}
        onBack={() => router.back()}
      />

      <View style={styles.monthSwitcher}>
        <PressFeedback
          baseColor="transparent"
          onPress={() => goToMonth(-1)}
          style={styles.monthArrow}
        >
          <Feather
            name="chevron-left"
            size={layout.iconHeader}
            color={palette.link}
          />
        </PressFeedback>
        <Text style={type.bodyBold}>{formatMonthDisplay(month)}</Text>
        <PressFeedback
          baseColor="transparent"
          onPress={() => goToMonth(1)}
          style={styles.monthArrow}
        >
          <Feather
            name="chevron-right"
            size={layout.iconHeader}
            color={palette.link}
          />
        </PressFeedback>
      </View>

      <MonthTransitionView monthKey={month} direction={monthDirection}>
        <FabSafeScrollView
          contentContainerStyle={{
            paddingHorizontal: layout.gutter,
            paddingTop: layout.sectionGap,
          }}
        >
          <View style={styles.summaryRow}>
            <View style={styles.summaryTile}>
              <Text style={type.caption}>Income</Text>
              <AmountText
                amount={summary.totalIncome}
                color={palette.positive}
                style={styles.summaryAmount}
              />
            </View>
            <View style={styles.summaryTile}>
              <Text style={type.caption}>Expenses</Text>
              <AmountText
                amount={summary.totalExpenses}
                kind="expense"
                style={styles.summaryAmount}
              />
            </View>
            <View style={styles.summaryTile}>
              <Text style={type.caption}>Net</Text>
              <AmountText
                amount={summary.netSavings}
                style={styles.summaryAmount}
              />
            </View>
          </View>

          <Overline style={styles.sectionLabel}>Planned vs actual</Overline>

          {summary.plannedVsActual.length === 0 && (
            <View style={styles.empty}>
              <Feather name="pie-chart" size={24} color={palette.textMuted} />
              <Text style={type.body}>No expense categories yet</Text>
              <Text style={[type.caption, styles.emptyDesc]}>
                Add an expense category in Settings to start budgeting
              </Text>
            </View>
          )}

          {summary.plannedVsActual.map((row) => {
            const overBudget = row.planned > 0 && row.actual > row.planned;
            const progress =
              row.planned > 0 ? Math.min(1, row.actual / row.planned) : 0;
            const isEditing = editingCategoryId === row.categoryId;

            return (
              <View key={row.categoryId} style={styles.categoryCard}>
                <View style={styles.categoryRow}>
                  <Text style={type.rowTitle}>{row.categoryName}</Text>
                  <Text style={styles.categoryActual}>
                    <AmountText
                      amount={row.actual}
                      showCurrency={false}
                      color={overBudget ? palette.alert : palette.textPrimary}
                    />
                    <Text style={type.caption}>
                      {" "}
                      / {CURRENCY_SYMBOL}
                      {row.planned.toFixed(2)}
                    </Text>
                  </Text>
                </View>

                {row.planned > 0 && (
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${progress * 100}%`,
                          backgroundColor: overBudget
                            ? palette.alert
                            : palette.link,
                        },
                      ]}
                    />
                  </View>
                )}

                {isEditing ? (
                  <View style={styles.editRow}>
                    <View style={styles.editAmountBox}>
                      <Text style={styles.editPrefix}>{CURRENCY_SYMBOL}</Text>
                      <TextInput
                        style={styles.editInput}
                        keyboardType="decimal-pad"
                        placeholderTextColor={palette.textMuted}
                        value={editingValue}
                        onChangeText={setEditingValue}
                        autoFocus
                        onSubmitEditing={saveEdit}
                        returnKeyType="done"
                      />
                    </View>
                    <Pressable
                      onPress={saveEdit}
                      style={styles.editAction}
                      hitSlop={6}
                    >
                      <Feather name="check" size={18} color={palette.link} />
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingCategoryId(null)}
                      style={styles.editAction}
                      hitSlop={6}
                    >
                      <Feather name="x" size={18} color={palette.textMuted} />
                    </Pressable>
                  </View>
                ) : (
                  <PressFeedback
                    baseColor="transparent"
                    onPress={() => startEdit(row.categoryId, row.planned)}
                    style={styles.setBudgetBtn}
                  >
                    <Feather
                      name="edit-2"
                      size={12}
                      color={palette.link}
                      style={styles.setBudgetIcon}
                    />
                    <Text style={styles.setBudgetBtnText}>
                      {row.planned > 0
                        ? "Edit planned amount"
                        : "Set planned amount"}
                    </Text>
                  </PressFeedback>
                )}
              </View>
            );
          })}
        </FabSafeScrollView>
      </MonthTransitionView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  monthSwitcher: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.gutter,
    paddingVertical: layout.gapMd,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  monthArrow: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    gap: layout.gapSm,
    marginBottom: layout.sectionGap,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: layout.radiusContainer,
    padding: layout.gapMd,
    alignItems: "center",
  },
  summaryAmount: {
    marginTop: 4,
  },
  sectionLabel: {
    marginBottom: layout.gapSm,
  },
  categoryCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapLg,
    marginBottom: layout.gapMd,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: layout.gapSm,
  },
  categoryActual: {
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    height: 4,
    borderRadius: layout.radiusPill,
    backgroundColor: palette.divider,
    overflow: "hidden",
    marginBottom: layout.gapMd,
  },
  progressFill: {
    height: "100%",
    borderRadius: layout.radiusPill,
  },
  setBudgetBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  setBudgetIcon: {
    marginRight: layout.gapSm,
  },
  setBudgetBtnText: {
    fontSize: type.section.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.link,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: layout.gapSm,
  },
  editAmountBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.link,
    borderRadius: 10,
    paddingHorizontal: layout.gapMd,
    height: 42,
  },
  editPrefix: {
    fontSize: type.body.fontSize,
    fontFamily: type.caption.fontFamily,
    color: palette.textSecondary,
    marginRight: layout.gapSm,
  },
  editInput: {
    flex: 1,
    minWidth: 0,
    fontSize: type.bodyBold.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.textPrimary,
  },
  editAction: {
    padding: 6,
  },
  empty: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.sectionGap * 2,
    gap: layout.gapSm,
  },
  emptyDesc: {
    textAlign: "center",
  },
});
