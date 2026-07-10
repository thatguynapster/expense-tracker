import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { formatCurrency } from '@/utils/format';
import { formatMonthDisplay } from '@/utils/month';

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export default function BudgetScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const setBudget = useStore((s) => s.setBudget);
  const getMonthSummary = useStore((s) => s.getMonthSummary);

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const month = monthKey(monthDate);
  const summary = getMonthSummary(month);

  const startEdit = (categoryId: string, currentPlanned: number) => {
    setEditingCategoryId(categoryId);
    setEditingValue(currentPlanned > 0 ? String(currentPlanned) : '');
  };

  const saveEdit = async () => {
    if (!editingCategoryId) return;
    const amount = parseFloat(editingValue) || 0;
    await setBudget(editingCategoryId, month, amount);
    await Haptics.selectionAsync();
    setEditingCategoryId(null);
    setEditingValue('');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        { paddingTop: isWeb ? 67 : insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Budget</Text>
      </View>

      <View style={[styles.monthSwitcher, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => setMonthDate((d) => addMonths(d, -1))} style={styles.monthArrow}>
          <Feather name="chevron-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.foreground }]}>{formatMonthDisplay(month)}</Text>
        <TouchableOpacity onPress={() => setMonthDate((d) => addMonths(d, 1))} style={styles.monthArrow}>
          <Feather name="chevron-right" size={20} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{formatCurrency(summary.totalIncome)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.danger }]}>{formatCurrency(summary.totalExpenses)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Net</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatCurrency(summary.netSavings)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>PLANNED VS ACTUAL</Text>

        {summary.plannedVsActual.length === 0 && (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="pie-chart" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No expense categories yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Add an expense category in Settings to start budgeting
            </Text>
          </View>
        )}

        {summary.plannedVsActual.map((row) => {
          const overBudget = row.planned > 0 && row.actual > row.planned;
          const progress = row.planned > 0 ? Math.min(1, row.actual / row.planned) : 0;

          return (
            <View
              key={row.categoryId}
              style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.categoryRow}>
                <Text style={[styles.categoryName, { color: colors.foreground }]}>{row.categoryName}</Text>
                <Text style={[styles.categoryActual, { color: overBudget ? colors.danger : colors.foreground }]}>
                  {formatCurrency(row.actual)}
                  <Text style={{ color: colors.mutedForeground }}> / {formatCurrency(row.planned)}</Text>
                </Text>
              </View>

              {row.planned > 0 && (
                <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                  <View style={[
                    styles.progressFill,
                    { width: `${progress * 100}%`, backgroundColor: overBudget ? colors.danger : colors.primary },
                  ]} />
                </View>
              )}

              {editingCategoryId === row.categoryId ? (
                <View style={styles.editRow}>
                  <View style={[styles.editAmountBox, { backgroundColor: colors.background, borderColor: colors.primary }]}>
                    <Text style={[styles.editPrefix, { color: colors.mutedForeground }]}>GH₵</Text>
                    <TextInput
                      style={[styles.editInput, { color: colors.foreground }]}
                      keyboardType="decimal-pad"
                      value={editingValue}
                      onChangeText={setEditingValue}
                      autoFocus
                      onSubmitEditing={saveEdit}
                      returnKeyType="done"
                    />
                  </View>
                  <TouchableOpacity onPress={saveEdit} style={styles.editAction}>
                    <Feather name="check" size={18} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingCategoryId(null)} style={styles.editAction}>
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.setBudgetBtn}
                  onPress={() => startEdit(row.categoryId, row.planned)}
                >
                  <Feather name="edit-2" size={12} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[styles.setBudgetBtnText, { color: colors.primary }]}>
                    {row.planned > 0 ? 'Edit planned amount' : 'Set planned amount'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  monthArrow: { padding: 8 },
  monthLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  categoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  categoryActual: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  setBudgetBtn: { flexDirection: 'row', alignItems: 'center' },
  setBudgetBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editAmountBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  editPrefix: { fontSize: 14, fontFamily: 'Inter_500Medium', marginRight: 6 },
  editInput: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  editAction: { padding: 6 },
  empty: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
});
