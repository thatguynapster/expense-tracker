import React from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  AmountText,
  DestructiveButton,
  FabSafeScrollView,
  GroupedList,
  HeaderIconButton,
  Overline,
  Row,
  ScreenHeader,
} from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { useStore } from '@/store/useStore';
import { formatDate } from '@/utils/format';
import type { AmountKind } from '@/components/ui';

export default function TransactionDetailScreen() {
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
            // §5: delete confirm gets a Medium impact haptic at the tap itself,
            // not a success notification after the fact.
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await deleteTransaction(id);
            if (!result.success) {
              Alert.alert('Error', result.error ?? 'Failed to delete.');
              return;
            }
            router.back();
          },
        },
      ]
    );
  };

  if (!transaction) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={type.caption}>Transaction not found.</Text>
      </View>
    );
  }

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const amountKind: AmountKind = isIncome ? 'income' : isExpense ? 'expense' : 'transfer';
  const typeLabel = isIncome ? 'Income' : isExpense ? 'Expense' : 'Transfer';

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={typeLabel}
        paddingTop={isWeb ? 67 : insets.top + 10}
        onBack={() => router.back()}
        right={<HeaderIconButton icon="edit-2" onPress={handleEdit} />}
      />

      <FabSafeScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: layout.sectionGap }}>
        <View style={styles.summaryCard}>
          <AmountText amount={transaction.amount} kind={amountKind} size="title" style={styles.summaryAmount} />
          <Text style={[type.caption, styles.summaryDate]}>{formatDate(transaction.date)}</Text>
        </View>

        <GroupedList style={styles.section}>
          {isExpense && (
            <>
              <Row title="Account" right={<Text style={type.body}>{accountName(transaction.fromAccountId)}</Text>} />
              {categoryName(transaction.categoryId) && (
                <Row title="Category" right={<Text style={type.body}>{categoryName(transaction.categoryId)}</Text>} />
              )}
            </>
          )}

          {isIncome && (
            <>
              <Row title="Deposited Into" right={<Text style={type.body}>{accountName(transaction.toAccountId)}</Text>} />
              <Row title="Saved Into" right={<Text style={type.body}>{accountName(transaction.savingsAccountId)}</Text>} />
              <Row title="Savings Amount" right={<AmountText amount={transaction.savingsAmount ?? 0} />} />
              {categoryName(transaction.categoryId) && (
                <Row title="Category" right={<Text style={type.body}>{categoryName(transaction.categoryId)}</Text>} />
              )}
            </>
          )}

          {!isIncome && !isExpense && (
            <>
              <Row title="From" right={<Text style={type.body}>{accountName(transaction.fromAccountId)}</Text>} />
              <Row title="To" right={<Text style={type.body}>{accountName(transaction.toAccountId)}</Text>} />
              {transaction.reason && (
                <Row title="Reason" right={<Text style={type.body}>{transaction.reason}</Text>} />
              )}
              {transaction.countsAsDebtRepayment && (
                <Row title="Discipline Debt" right={<Text style={type.body}>Counted as repayment</Text>} />
              )}
            </>
          )}
        </GroupedList>

        {transaction.note && (
          <View style={[styles.section, styles.noteCard]}>
            <Overline style={styles.noteLabel}>Note</Overline>
            <Text style={type.body}>{transaction.note}</Text>
          </View>
        )}

        <DestructiveButton label="Delete Transaction" onPress={handleDelete} />
      </FabSafeScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusHero,
    padding: 20,
    alignItems: 'center',
  },
  summaryAmount: {
    textAlign: 'center',
  },
  summaryDate: {
    marginTop: 6,
  },
  section: {
    marginTop: layout.sectionGap,
  },
  noteCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapMd,
  },
  noteLabel: {
    marginBottom: layout.gapSm,
  },
});
