import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  AmountField,
  AmountText,
  CheckboxRow,
  ChipGroup,
  Field,
  InfoBanner,
  Row,
  SaveButton,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { CalendarPicker } from '@/components/CalendarPicker';
import { useStore } from '@/store/useStore';
import { formatCurrency } from '@/utils/format';
import { sortAccounts, sortCategoriesAlphabetically } from '@/utils/sorting';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

type TxType = 'expense' | 'income' | 'transfer';

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddTransactionScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const accounts = sortAccounts(useStore((s) => s.accounts).filter((a) => !a.deletedAt));
  // Soft-deleted categories stay in local storage until sync purges them —
  // filter them out of the picker. Also split by type so the expense form
  // only ever shows expense categories and vice versa.
  const activeCategories = useStore((s) => s.categories).filter((c) => !c.deletedAt);
  const expenseCategories = sortCategoriesAlphabetically(activeCategories.filter((c) => c.type === 'expense'));
  const incomeCategories = sortCategoriesAlphabetically(activeCategories.filter((c) => c.type === 'income'));
  const transactions = useStore((s) => s.transactions);
  const existing = transactions.find((t) => t.id === id && !t.deletedAt);
  const addIncome = useStore((s) => s.addIncome);
  const addExpense = useStore((s) => s.addExpense);
  const addTransfer = useStore((s) => s.addTransfer);
  const updateIncome = useStore((s) => s.updateIncome);
  const updateExpense = useStore((s) => s.updateExpense);
  const updateTransfer = useStore((s) => s.updateTransfer);
  const disciplineDebt = useStore((s) => s.getDisciplineDebt)();

  const [txType, setTxType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  // Expense fields
  const [expAccountId, setExpAccountId] = useState('');
  const [expCategoryId, setExpCategoryId] = useState('');

  // Income fields
  const [incSpendableId, setIncSpendableId] = useState('');
  const [incProtectedId, setIncProtectedId] = useState('');
  const [incCategoryId, setIncCategoryId] = useState('');
  const [savingsAmount, setSavingsAmount] = useState('');

  // Transfer fields
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [reason, setReason] = useState('');
  const [countsAsDebt, setCountsAsDebt] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setTxType(existing.type);
    setAmount(String(existing.amount));
    setNote(existing.note ?? '');
    setDate(parseLocalDate(existing.date.split('T')[0]!));
    if (existing.type === 'expense') {
      setExpAccountId(existing.fromAccountId ?? '');
      setExpCategoryId(existing.categoryId ?? '');
    } else if (existing.type === 'income') {
      setIncSpendableId(existing.toAccountId ?? '');
      setIncProtectedId(existing.savingsAccountId ?? '');
      setIncCategoryId(existing.categoryId ?? '');
      setSavingsAmount(String(existing.savingsAmount ?? ''));
    } else {
      setFromAccountId(existing.fromAccountId ?? '');
      setToAccountId(existing.toAccountId ?? '');
      setReason(existing.reason ?? '');
      setCountsAsDebt(existing.countsAsDebtRepayment ?? false);
    }
  }, [existing?.id]);

  const spendableAccounts = accounts.filter((a) => a.type === 'spendable');
  const protectedAccounts = accounts.filter((a) => a.type === 'protected');

  const amountNum = parseFloat(amount) || 0;
  const minimumSavings = amountNum * 0.1;
  const savingsNum = parseFloat(savingsAmount) || minimumSavings;
  const spendablePortionPreview = amountNum - savingsNum;

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const isProtectedToSpendable =
    fromAccount?.type === 'protected' && toAccount?.type === 'spendable';
  const isSpendableToProtected =
    fromAccount?.type === 'spendable' && toAccount?.type === 'protected';

  const onAmountChange = (val: string) => {
    setAmount(val);
    const num = parseFloat(val) || 0;
    setSavingsAmount((num * 0.1).toFixed(2));
  };

  const executeSave = async () => {
    const dateStr = dateToStr(date) + 'T00:00:00.000Z';
    setSaving(true);
    try {
      if (txType === 'expense') {
        const params = {
          amount: amountNum,
          accountId: expAccountId,
          categoryId: expCategoryId,
          date: dateStr,
          note: note || undefined,
        };
        const result = isEditing ? await updateExpense(id, params) : await addExpense(params);
        if (!result.success) {
          Alert.alert('Error', result.error ?? 'Failed to save.');
          return;
        }
        if (result.willGoDanger) {
          Alert.alert(
            'Off-track warning',
            'This expense will make you financially off-track for the rest of the month.',
            [{ text: 'Understood', onPress: () => router.back() }]
          );
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return;
        }
      } else if (txType === 'income') {
        const params = {
          amount: amountNum,
          spendableAccountId: incSpendableId,
          protectedAccountId: incProtectedId,
          selectedSavingsAmount: savingsNum,
          date: dateStr,
          categoryId: incCategoryId || undefined,
          note: note || undefined,
        };
        const result = isEditing ? await updateIncome(id, params) : await addIncome(params);
        if (!result.success) {
          Alert.alert('Error', result.error ?? 'Failed to save.');
          return;
        }
      } else {
        const params = {
          amount: amountNum,
          fromAccountId,
          toAccountId,
          date: dateStr,
          note: note || undefined,
          reason: reason || undefined,
          countsAsDebtRepayment: countsAsDebt,
        };
        const result = isEditing ? await updateTransfer(id, params) : await addTransfer(params);
        if (!result.success) {
          Alert.alert('Error', result.error ?? 'Failed to save.');
          return;
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!amount || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }

    if (txType === 'expense') {
      if (!expAccountId) {
        Alert.alert('Select account', 'Please select an account.');
        return;
      }
      if (!expCategoryId) {
        Alert.alert('Select category', 'Please select a category.');
        return;
      }
      await executeSave();
    } else if (txType === 'income') {
      if (!incSpendableId || !incProtectedId) {
        Alert.alert('Select accounts', 'Please select spendable and savings accounts.');
        return;
      }
      await executeSave();
    } else {
      if (!fromAccountId || !toAccountId) {
        Alert.alert('Select accounts', 'Please select both accounts.');
        return;
      }
      if (isProtectedToSpendable && !reason.trim()) {
        Alert.alert('Reason required', 'Please enter a reason for withdrawing from savings.');
        return;
      }

      // Withdrawing from protected savings requires a reason AND a
      // confirmation modal that gates the save (PRD MVP criterion #10) —
      // this can't be skipped by just filling the reason field and tapping
      // Save once; the user must explicitly confirm this specific action.
      if (isProtectedToSpendable) {
        Alert.alert(
          'Confirm Withdrawal',
          `Withdraw ${formatCurrency(amountNum)} from ${fromAccount?.name ?? 'Protected'} into ${toAccount?.name ?? 'Spendable'}? This increases your Discipline Debt and cannot be undone.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm Withdrawal', style: 'destructive', onPress: () => executeSave() },
          ]
        );
        return;
      }

      await executeSave();
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEditing ? 'Edit Transaction' : 'Add Transaction'}
        paddingTop={isWeb ? 67 : insets.top + 10}
        onClose={() => router.back()}
        right={<SaveButton onPress={handleSave} disabled={saving} />}
      />

      {/* Type tabs */}
      <View style={styles.typeTabs}>
        {(['expense', 'income', 'transfer'] as TxType[]).map((t) => {
          const selected = txType === t;
          return (
            <Pressable
              key={t}
              style={[styles.typeTab, selected && styles.typeTabSelected, isEditing && !selected && styles.typeTabDisabled]}
              onPress={() => !isEditing && setTxType(t)}
              disabled={isEditing}
            >
              <Text style={[styles.typeTabText, selected && styles.typeTabTextSelected]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {isEditing && (
        <Text style={[type.caption, styles.editTypeNote]}>
          Type can’t be changed when editing — delete and re-add for that.
        </Text>
      )}

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingBottom: (isWeb ? 34 : insets.bottom) + layout.sectionGap,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Amount">
          <AmountField value={amount} onChangeText={onAmountChange} />
        </Field>

        {/* EXPENSE FORM */}
        {txType === 'expense' && (
          <>
            <Field label="Account">
              <ChipGroup
                options={spendableAccounts.map((a) => ({ id: a.id, name: a.name }))}
                value={expAccountId}
                onSelect={setExpAccountId}
                emptyText="No spendable accounts. Add one first."
              />
            </Field>
            <Field label="Category">
              <ChipGroup
                options={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
                value={expCategoryId}
                onSelect={setExpCategoryId}
                allowDeselect
                emptyText="No expense categories. Add one in Settings first."
              />
            </Field>
          </>
        )}

        {/* INCOME FORM */}
        {txType === 'income' && (
          <>
            <Field label="Spendable Account">
              <ChipGroup
                options={spendableAccounts.map((a) => ({ id: a.id, name: a.name }))}
                value={incSpendableId}
                onSelect={setIncSpendableId}
                emptyText="No spendable accounts."
              />
            </Field>
            <Field label="Savings Account (Protected)">
              <ChipGroup
                options={protectedAccounts.map((a) => ({ id: a.id, name: a.name }))}
                value={incProtectedId}
                onSelect={setIncProtectedId}
                emptyText="No protected accounts."
              />
            </Field>
            <Field label="Category (optional)">
              <ChipGroup
                options={incomeCategories.map((c) => ({ id: c.id, name: c.name }))}
                value={incCategoryId}
                onSelect={setIncCategoryId}
                allowDeselect
                emptyText="No income categories."
              />
            </Field>
            {amountNum > 0 && (
              <View style={styles.savingsPreview}>
                <Row title="Income received" right={<AmountText amount={amountNum} />} />
                <Row title="Minimum savings (10%)" right={<AmountText amount={minimumSavings} color={palette.caution} />} />
                <Field label={`Savings Amount (min ${formatCurrency(minimumSavings)})`} style={styles.savingsFieldGroup}>
                  <AmountField value={savingsAmount} onChangeText={setSavingsAmount} />
                  {savingsNum < minimumSavings && (
                    <Text style={[type.caption, styles.validationError]}>
                      Minimum savings is 10% of received income.
                    </Text>
                  )}
                </Field>
                <Row
                  title="Spendable amount"
                  right={<AmountText amount={Math.max(0, spendablePortionPreview)} color={palette.positive} />}
                />
              </View>
            )}
          </>
        )}

        {/* TRANSFER FORM */}
        {txType === 'transfer' && (
          <>
            <Field label="From Account">
              <ChipGroup
                options={accounts.map((a) => ({ id: a.id, name: a.name }))}
                value={fromAccountId}
                onSelect={(id) => {
                  setFromAccountId(id);
                  if (id === toAccountId) setToAccountId('');
                }}
                emptyText="No accounts."
              />
            </Field>
            <Field label="To Account">
              <ChipGroup
                options={accounts.filter((a) => a.id !== fromAccountId).map((a) => ({ id: a.id, name: a.name }))}
                value={toAccountId}
                onSelect={setToAccountId}
                emptyText="No accounts."
              />
            </Field>

            {isProtectedToSpendable && (
              <InfoBanner family="alert" icon="alert-triangle">
                Withdrawing from protected savings increases your Discipline Debt.
              </InfoBanner>
            )}

            {isProtectedToSpendable && (
              <Field label="Reason (required)">
                <TextField
                  placeholder="Why are you withdrawing from savings?"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                />
              </Field>
            )}

            {isSpendableToProtected && disciplineDebt > 0 && (
              <CheckboxRow
                checked={countsAsDebt}
                onToggle={() => setCountsAsDebt((v) => !v)}
                label="Count as Discipline Debt repayment"
                description={`Current debt: ${formatCurrency(disciplineDebt)}`}
                accent="positive"
              />
            )}
          </>
        )}

        <Field label="Note (optional)">
          <TextField placeholder="Add a note..." value={note} onChangeText={setNote} />
        </Field>

        <Field label="Date">
          <CalendarPicker value={date} onChange={setDate} maximumDate={new Date()} />
        </Field>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  typeTabs: {
    flexDirection: 'row',
    marginHorizontal: layout.gutter,
    marginTop: layout.gapLg,
    marginBottom: layout.gapLg,
    backgroundColor: palette.surface,
    borderRadius: layout.radiusContainer,
    padding: 4,
  },
  typeTab: {
    flex: 1,
    paddingVertical: layout.gapSm,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeTabSelected: {
    backgroundColor: palette.surfaceRaised,
  },
  typeTabText: {
    fontSize: type.body.fontSize,
    fontFamily: type.caption.fontFamily,
    color: palette.textSecondary,
  },
  typeTabTextSelected: {
    fontFamily: type.bodyBold.fontFamily,
    color: palette.textPrimary,
  },
  typeTabDisabled: {
    opacity: 0.4,
  },
  editTypeNote: {
    marginHorizontal: layout.gutter,
    marginTop: -8,
    marginBottom: layout.gapLg,
  },
  savingsPreview: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    paddingHorizontal: layout.gapMd,
    marginBottom: layout.sectionGap,
  },
  savingsFieldGroup: {
    marginTop: layout.gapSm,
    marginBottom: layout.gapMd,
  },
  validationError: {
    color: palette.alert,
    marginTop: layout.gapSm,
  },
});
