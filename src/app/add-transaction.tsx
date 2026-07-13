import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
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

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddTransactionScreen() {
  const colors = useColors();
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
    // strip anything that's not a digit or decimal point
    const clean = val.replace(/[^0-9.]/g, '');
    setAmount(clean);
    const num = parseFloat(clean) || 0;
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

  const SelectRow = ({
    label,
    value,
    options,
    onSelect,
    placeholder,
  }: {
    label: string;
    value: string;
    options: { id: string; name: string }[];
    onSelect: (id: string) => void;
    placeholder: string;
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={styles.optionList}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.optionChip,
              {
                backgroundColor: value === opt.id ? colors.primary : colors.muted,
                borderColor: value === opt.id ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onSelect(opt.id)}
          >
            <Text
              style={[
                styles.optionText,
                { color: value === opt.id ? colors.primaryForeground : colors.foreground },
              ]}
            >
              {opt.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {options.length === 0 && (
        <Text style={[styles.noOptions, { color: colors.mutedForeground }]}>{placeholder}</Text>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header,
        {
          paddingTop: isWeb ? 67 : insets.top + 10,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isEditing ? 'Edit Transaction' : 'Add Transaction'}
        </Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Type Tabs */}
      <View style={[styles.typeTabs, { backgroundColor: colors.muted }]}>
        {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.typeTab,
              { backgroundColor: txType === t ? colors.card : 'transparent' },
              isEditing && txType !== t && styles.typeTabDisabled,
            ]}
            onPress={() => !isEditing && setTxType(t)}
            disabled={isEditing}
          >
            <Text
              style={[
                styles.typeTabText,
                { color: txType === t ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {isEditing && (
        <Text style={[styles.editTypeNote, { color: colors.mutedForeground }]}>
          Type can’t be changed when editing — delete and re-add for that.
        </Text>
      )}

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.formContent,
          { paddingBottom: isWeb ? 34 + 24 : insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Amount</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>GH₵</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={onAmountChange}
            />
          </View>
        </View>

        {/* EXPENSE FORM */}
        {txType === 'expense' && (
          <>
            <SelectRow
              label="Account"
              value={expAccountId}
              options={spendableAccounts.map((a) => ({ id: a.id, name: a.name }))}
              onSelect={setExpAccountId}
              placeholder="No spendable accounts. Add one first."
            />
            <SelectRow
              label="Category"
              value={expCategoryId}
              options={expenseCategories.map((c) => ({ id: c.id, name: c.name }))}
              onSelect={(id) => setExpCategoryId((prev) => (prev === id ? '' : id))}
              placeholder="No expense categories. Add one in Settings first."
            />
          </>
        )}

        {/* INCOME FORM */}
        {txType === 'income' && (
          <>
            <SelectRow
              label="Spendable Account"
              value={incSpendableId}
              options={spendableAccounts.map((a) => ({ id: a.id, name: a.name }))}
              onSelect={setIncSpendableId}
              placeholder="No spendable accounts."
            />
            <SelectRow
              label="Savings Account (Protected)"
              value={incProtectedId}
              options={protectedAccounts.map((a) => ({ id: a.id, name: a.name }))}
              onSelect={setIncProtectedId}
              placeholder="No protected accounts."
            />
            <SelectRow
              label="Category (optional)"
              value={incCategoryId}
              options={incomeCategories.map((c) => ({ id: c.id, name: c.name }))}
              onSelect={(id) => setIncCategoryId((prev) => (prev === id ? '' : id))}
              placeholder="No income categories."
            />
            {amountNum > 0 && (
              <View style={[styles.savingsPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.savingsRow}>
                  <Text style={[styles.savingsKey, { color: colors.mutedForeground }]}>Income received</Text>
                  <Text style={[styles.savingsVal, { color: colors.foreground }]}>
                    {formatCurrency(amountNum)}
                  </Text>
                </View>
                <View style={styles.savingsRow}>
                  <Text style={[styles.savingsKey, { color: colors.mutedForeground }]}>Minimum savings (10%)</Text>
                  <Text style={[styles.savingsVal, { color: colors.warning }]}>
                    {formatCurrency(minimumSavings)}
                  </Text>
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                    Savings Amount (min {formatCurrency(minimumSavings)})
                  </Text>
                  <View style={[styles.amountRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>GH₵</Text>
                    <TextInput
                      style={[styles.amountInput, { color: colors.foreground }]}
                      keyboardType="decimal-pad"
                      value={savingsAmount}
                      onChangeText={setSavingsAmount}
                    />
                  </View>
                  {savingsNum < minimumSavings && (
                    <Text style={[styles.validationError, { color: colors.danger }]}>
                      Minimum savings is 10% of received income.
                    </Text>
                  )}
                </View>
                <View style={styles.savingsRow}>
                  <Text style={[styles.savingsKey, { color: colors.mutedForeground }]}>Spendable amount</Text>
                  <Text style={[styles.savingsVal, { color: colors.success }]}>
                    {formatCurrency(Math.max(0, spendablePortionPreview))}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* TRANSFER FORM */}
        {txType === 'transfer' && (
          <>
            <SelectRow
              label="From Account"
              value={fromAccountId}
              options={accounts.map((a) => ({ id: a.id, name: a.name }))}
              onSelect={(id) => {
                setFromAccountId(id);
                if (id === toAccountId) setToAccountId('');
              }}
              placeholder="No accounts."
            />
            <SelectRow
              label="To Account"
              value={toAccountId}
              options={accounts.filter((a) => a.id !== fromAccountId).map((a) => ({ id: a.id, name: a.name }))}
              onSelect={setToAccountId}
              placeholder="No accounts."
            />

            {isProtectedToSpendable && (
              <View style={[styles.warningBanner, { backgroundColor: colors.dangerBg, borderColor: colors.danger + '40' }]}>
                <Feather name="alert-triangle" size={16} color={colors.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.warningText, { color: colors.danger }]}>
                  Withdrawing from protected savings increases your Discipline Debt.
                </Text>
              </View>
            )}

            {isProtectedToSpendable && (
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                  Reason (required)
                </Text>
                <TextInput
                  style={[
                    styles.textArea,
                    { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
                  ]}
                  placeholder="Why are you withdrawing from savings?"
                  placeholderTextColor={colors.mutedForeground}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}

            {isSpendableToProtected && disciplineDebt > 0 && (
              <TouchableOpacity
                style={[
                  styles.debtRepayRow,
                  {
                    backgroundColor: countsAsDebt ? colors.successBg : colors.card,
                    borderColor: countsAsDebt ? colors.success : colors.border,
                  },
                ]}
                onPress={() => setCountsAsDebt(!countsAsDebt)}
              >
                <View style={[
                  styles.checkbox,
                  {
                    backgroundColor: countsAsDebt ? colors.success : 'transparent',
                    borderColor: countsAsDebt ? colors.success : colors.mutedForeground,
                  },
                ]}>
                  {countsAsDebt && <Feather name="check" size={12} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.debtRepayLabel, { color: colors.foreground }]}>
                    Count as Discipline Debt repayment
                  </Text>
                  <Text style={[styles.debtRepayDesc, { color: colors.mutedForeground }]}>
                    Current debt: {formatCurrency(disciplineDebt)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Note */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Note (optional)</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Add a note..."
            placeholderTextColor={colors.mutedForeground}
            value={note}
            onChangeText={setNote}
          />
        </View>

        {/* Date Picker */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Date</Text>
          <CalendarPicker
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
          />
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  typeTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  typeTabText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  typeTabDisabled: { opacity: 0.4 },
  editTypeNote: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginHorizontal: 16,
    marginTop: -8,
    marginBottom: 16,
  },
  formContent: { paddingHorizontal: 16 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 56,
  },
  currencyPrefix: { fontSize: 18, fontFamily: 'Inter_500Medium', marginRight: 8 },
  amountInput: { flex: 1, minWidth: 0, fontSize: 28, fontFamily: 'Inter_600SemiBold' },
  optionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  noOptions: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 4 },
  savingsPreview: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  savingsKey: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  savingsVal: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1, marginVertical: 10 },
  validationError: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  dateButtonText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  webDateWrap: {
    marginTop: -12,
    marginBottom: 8,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  debtRepayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debtRepayLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  debtRepayDesc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
