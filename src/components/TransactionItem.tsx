import React from 'react';
import { router } from 'expo-router';

import { AmountText, Row } from '@/components/ui';
import { categoryIcons, categoryVisual, palette, type FeatherIconName } from '@/theme/theme';
import type { Account, Category, Transaction } from '@/lib/types';

interface Props {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
}

/**
 * One transaction as a GroupedList row (§3.1/§3.2): bare tinted glyph, title +
 * one caption line, right-aligned amount. No date — the date group header
 * states it once (§3.3). Transfers get the dimmed internal-movement treatment.
 */
export function TransactionItem({ transaction, accounts, categories }: Props) {
  const fromAccount = accounts.find((a) => a.id === transaction.fromAccountId);
  const toAccount = accounts.find((a) => a.id === transaction.toAccountId);
  const category = categories.find((c) => c.id === transaction.categoryId);

  const isTransfer = transaction.type === 'transfer';

  let title: string;
  let account: string;
  let visual: { tint: string; icon: FeatherIconName };

  if (transaction.type === 'income') {
    title = 'Income';
    account = toAccount?.name ?? '';
    visual = categoryVisual(category ?? { name: '', type: 'income' });
  } else if (transaction.type === 'expense') {
    title = category?.name ?? 'Expense';
    account = fromAccount?.name ?? '';
    visual = categoryVisual(category);
  } else {
    title = 'Transfer';
    account = `${fromAccount?.name ?? '?'} → ${toAccount?.name ?? '?'}`;
    visual = { tint: palette.category.transfer, icon: categoryIcons.transfer };
  }

  const subtitle = [account, transaction.note].filter(Boolean).join(' · ');

  return (
    <Row
      icon={visual.icon}
      iconTint={visual.tint}
      title={title}
      subtitle={subtitle}
      dimmed={isTransfer}
      right={
        <AmountText
          amount={transaction.amount}
          kind={isTransfer ? 'transfer' : transaction.type}
        />
      }
      onPress={() =>
        router.push({ pathname: '/transaction-detail', params: { id: transaction.id } })
      }
    />
  );
}
