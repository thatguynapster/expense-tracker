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
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddLoanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { borrowerName: prefilledBorrower } = useLocalSearchParams<{ borrowerName?: string }>();

  const accounts = useStore((s) => s.accounts);
  const addLoan = useStore((s) => s.addLoan);
  const spendableAccounts = accounts.filter((a) => a.type === 'spendable');

  const [borrowerName, setBorrowerName] = useState(prefilledBorrower ?? '');
  const [principal, setPrincipal] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [dateLent, setDateLent] = useState(new Date());
  const [hasExpectedDate, setHasExpectedDate] = useState(false);
  const [expectedRepaymentDate, setExpectedRepaymentDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const principalNum = parseFloat(principal) || 0;

  const onPrincipalChange = (val: string) => {
    setPrincipal(val.replace(/[^0-9.]/g, ''));
  };

  const handleSave = async () => {
    if (!borrowerName.trim()) {
      Alert.alert('Borrower required', 'Please enter who you’re lending to.');
      return;
    }
    if (!principal || principalNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid principal amount.');
      return;
    }
    if (!sourceAccountId) {
      Alert.alert('Select account', 'Please select which account the money is coming from.');
      return;
    }

    setSaving(true);
    try {
      const result = await addLoan({
        borrowerName: borrowerName.trim(),
        principal: principalNum,
        sourceAccountId,
        dateLent: dateToStr(dateLent) + 'T00:00:00.000Z',
        expectedRepaymentDate: hasExpectedDate ? dateToStr(expectedRepaymentDate) + 'T00:00:00.000Z' : null,
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

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        { paddingTop: isWeb ? 67 : insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Lend Money</Text>
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
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Borrower Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            placeholder="e.g. Kwame Mensah"
            placeholderTextColor={colors.mutedForeground}
            value={borrowerName}
            onChangeText={setBorrowerName}
            autoFocus={!prefilledBorrower}
            returnKeyType="next"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Principal Amount</Text>
          <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>GH₵</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.foreground }]}
              placeholder="0.00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={principal}
              onChangeText={onPrincipalChange}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>From Account</Text>
          <View style={styles.optionList}>
            {spendableAccounts.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: sourceAccountId === a.id ? colors.primary : colors.muted,
                    borderColor: sourceAccountId === a.id ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSourceAccountId(a.id)}
              >
                <Text style={[
                  styles.optionText,
                  { color: sourceAccountId === a.id ? colors.primaryForeground : colors.foreground },
                ]}>
                  {a.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {spendableAccounts.length === 0 && (
            <Text style={[styles.noOptions, { color: colors.mutedForeground }]}>
              No spendable accounts. Add one first.
            </Text>
          )}
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} style={{ marginRight: 8 }} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            This debits the account directly and won’t show up as an expense.
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Date Lent</Text>
          <CalendarPicker value={dateLent} onChange={setDateLent} maximumDate={new Date()} />
        </View>

        <TouchableOpacity
          style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setHasExpectedDate((v) => !v)}
        >
          <View style={[
            styles.checkbox,
            {
              backgroundColor: hasExpectedDate ? colors.primary : 'transparent',
              borderColor: hasExpectedDate ? colors.primary : colors.mutedForeground,
            },
          ]}>
            {hasExpectedDate && <Feather name="check" size={12} color={colors.primaryForeground} />}
          </View>
          <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
            Set an expected repayment date (optional)
          </Text>
        </TouchableOpacity>

        {hasExpectedDate && (
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Expected Repayment Date</Text>
            <CalendarPicker value={expectedRepaymentDate} onChange={setExpectedRepaymentDate} />
          </View>
        )}

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
  fieldGroup: { marginBottom: 20 },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
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
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  optionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  noOptions: { fontSize: 13, fontFamily: 'Inter_400Regular', paddingVertical: 4 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
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
  toggleLabel: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
});
