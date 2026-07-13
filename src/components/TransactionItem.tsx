import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Transaction, Account, Category } from '@/lib/types';
import { formatCurrency, formatDateShort } from '@/utils/format';

interface Props {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}

export function TransactionItem({ transaction, accounts, categories }: Props) {
  const colors = useColors();

  const fromAccount = accounts.find((a) => a.id === transaction.fromAccountId);
  const toAccount = accounts.find((a) => a.id === transaction.toAccountId);
  const savingsAccount = accounts.find((a) => a.id === transaction.savingsAccountId);
  const category = categories.find((c) => c.id === transaction.categoryId);

  const isIncome = transaction.type === 'income';
  const isExpense = transaction.type === 'expense';
  const isTransfer = transaction.type === 'transfer';

  let iconName: string;
  let iconColor: string;
  let iconBg: string;
  let label: string;
  let sublabel: string;
  let amountStr: string;
  let amountColor: string;

  if (isIncome) {
    iconName = 'arrow-down-circle';
    iconColor = colors.success;
    iconBg = colors.successBg;
    label = 'Income';
    sublabel = toAccount ? toAccount.name : '';
    amountStr = '+' + formatCurrency(transaction.amount);
    amountColor = colors.success;
  } else if (isExpense) {
    iconName = 'arrow-up-circle';
    iconColor = colors.danger;
    iconBg = colors.dangerBg;
    label = category ? category.name : 'Expense';
    sublabel = fromAccount ? fromAccount.name : '';
    amountStr = '-' + formatCurrency(transaction.amount);
    amountColor = colors.danger;
  } else {
    const isProtectedOut = fromAccount?.type === 'protected';
    const isProtectedIn = toAccount?.type === 'protected';
    iconName = 'repeat';
    iconColor = isProtectedOut ? colors.danger : isProtectedIn ? colors.warning : colors.primary;
    iconBg = isProtectedOut ? colors.dangerBg : isProtectedIn ? colors.warningBg : colors.muted;
    label = 'Transfer';
    sublabel = `${fromAccount?.name ?? '?'} → ${toAccount?.name ?? '?'}`;
    amountStr = formatCurrency(transaction.amount);
    amountColor = colors.foreground;
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/transaction-detail', params: { id: transaction.id } })}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Feather name={iconName as any} size={18} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.sublabel, { color: colors.mutedForeground }]} numberOfLines={1}>
          {sublabel || formatDateShort(transaction.date)}
        </Text>
        {transaction.note && (
          <Text style={[styles.note, { color: colors.mutedForeground }]} numberOfLines={1}>
            {transaction.note}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: amountColor }]}>{amountStr}</Text>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDateShort(transaction.date)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  sublabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  note: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    fontStyle: 'italic',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  date: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
