import React, { useState } from 'react';
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
import { sortAccounts } from '@/utils/sorting';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function RecordLoanRepaymentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { loanId } = useLocalSearchParams<{ loanId: string }>();

  const accounts = sortAccounts(useStore((s) => s.accounts).filter((a) => !a.deletedAt));
  const loans = useStore((s) => s.loans);
  const recordLoanRepayment = useStore((s) => s.recordLoanRepayment);
  const outstanding = useStore((s) => s.getLoanOutstanding)(loanId);
  const loan = loans.find((l) => l.id === loanId);
  const sourceAccount = accounts.find((a) => a.id === loan?.sourceAccountId);

  const [amount, setAmount] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount) || 0;

  const onAmountChange = (val: string) => {
    setAmount(val.replace(/[^0-9.]/g, ''));
  };

  const handleSave = async () => {
    if (!amount || amountNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (!destinationAccountId) {
      Alert.alert('Select account', 'Please select which account the money is going into.');
      return;
    }

    setSaving(true);
    try {
      const result = await recordLoanRepayment({
        loanId,
        amount: amountNum,
        destinationAccountId,
        date: dateToStr(date) + 'T00:00:00.000Z',
        note: note || undefined,
      });
      if (!result.success) {
        Alert.alert('Error', result.error ?? 'Failed to save.');
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!loan) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.mutedForeground }}>Loan not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        { paddingTop: isWeb ? 67 : insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Record Repayment</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={[styles.formContent, { paddingBottom: isWeb ? 34 + 24 : insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryBorrower, { color: colors.foreground }]}>{loan.borrowerName}</Text>
          <Text style={[styles.summaryOutstanding, { color: colors.mutedForeground }]}>
            Outstanding: {formatCurrency(outstanding)}
          </Text>
        </View>

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
              autoFocus
            />
          </View>
          {amountNum > outstanding && (
            <Text style={[styles.validationError, { color: colors.danger }]}>
              Cannot exceed the outstanding balance ({formatCurrency(outstanding)}).
            </Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Received Into</Text>
          <View style={styles.optionList}>
            {accounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: destinationAccountId === a.id ? colors.primary : colors.muted,
                    borderColor: destinationAccountId === a.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setDestinationAccountId(a.id)}
              >
                <Text style={[
                  styles.optionText,
                  { color: destinationAccountId === a.id ? colors.primaryForeground : colors.foreground },
                ]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Repayments always credit{sourceAccount ? ` ${sourceAccount.name}` : ' the account this loan was disbursed from'}, so its balance recovers regardless of where you actually received the cash. &quot;Received Into&quot; is just a record — it won&apos;t affect that account&apos;s balance. This won&apos;t show up as income.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Date</Text>
          <CalendarPicker value={date} onChange={setDate} maximumDate={new Date()} />
        </View>

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
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  formContent: { paddingHorizontal: 16, paddingTop: 24 },
  summaryBox: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  summaryBorrower: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  summaryOutstanding: { fontSize: 13, fontFamily: 'Inter_400Regular' },
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
  validationError: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6 },
  optionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  optionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});
