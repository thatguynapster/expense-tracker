import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { formatCurrency, formatDate } from '@/utils/format';

export default function TransactionDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { id } = useLocalSearchParams<{ id: string }>();

  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const deleteTransaction = useStore((s) => s.deleteTransaction);

  const transaction = transactions.find((t) => t.id === id && !t.deletedAt);

  const accountName = (accountId: string | null | undefined) =>
    accounts.find((a) => a.id === accountId)?.name ?? 'Unknown account';
  const categoryName = (categoryId: string | null | undefined) =>
    categories.find((c) => c.id === categoryId)?.name;

  const handleEdit = async () => {
    await Haptics.selectionAsync();
    router.push({ pathname: '/add-transaction', params: { id } });
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Transaction',
      'This reverses its effect on your account balances and cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteTransaction(id);
            if (!result.success) {
              Alert.alert('Error', result.error ?? 'Failed to delete.');
              return;
            }
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  if (!transaction) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.mutedForeground }}>Transaction not found.</Text>
      </View>
    );
  }

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amountColor = isIncome ? colors.success : isExpense ? colors.danger : colors.foreground;
  const amountPrefix = isIncome ? '+' : isExpense ? '-' : '';
  const typeLabel = isIncome ? 'Income' : isExpense ? 'Expense' : 'Transfer';

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        { paddingTop: isWeb ? 67 : insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{typeLabel}</Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
          <Feather name="edit-2" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryAmount, { color: amountColor }]}>
            {amountPrefix}{formatCurrency(transaction.amount)}
          </Text>
          <Text style={[styles.summaryDate, { color: colors.mutedForeground }]}>
            {formatDate(transaction.date)}
          </Text>
        </View>

        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {isExpense && (
            <>
              <Row label="Account" value={accountName(transaction.fromAccountId)} />
              {categoryName(transaction.categoryId) && (
                <Row label="Category" value={categoryName(transaction.categoryId)!} />
              )}
            </>
          )}

          {isIncome && (
            <>
              <Row label="Deposited Into" value={accountName(transaction.toAccountId)} />
              <Row label="Saved Into" value={accountName(transaction.savingsAccountId)} />
              <Row label="Savings Amount" value={formatCurrency(transaction.savingsAmount ?? 0)} />
              {categoryName(transaction.categoryId) && (
                <Row label="Category" value={categoryName(transaction.categoryId)!} />
              )}
            </>
          )}

          {!isIncome && !isExpense && (
            <>
              <Row label="From" value={accountName(transaction.fromAccountId)} />
              <Row label="To" value={accountName(transaction.toAccountId)} />
              {transaction.reason && <Row label="Reason" value={transaction.reason} />}
              {transaction.countsAsDebtRepayment && (
                <Row label="Discipline Debt" value="Counted as repayment" />
              )}
            </>
          )}
        </View>

        {transaction.note && (
          <View style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.noteLabel, { color: colors.mutedForeground }]}>NOTE</Text>
            <Text style={[styles.noteText, { color: colors.foreground }]}>{transaction.note}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.dangerBg, borderColor: colors.danger + '40' }]}
          onPress={handleDelete}
        >
          <Feather name="trash-2" size={15} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.deleteBtnText, { color: colors.danger }]}>Delete Transaction</Text>
        </TouchableOpacity>
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
  editBtn: { padding: 8 },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryAmount: { fontSize: 30, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  summaryDate: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  detailsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rowLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  rowValue: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  noteCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  noteLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  noteText: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
