import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  AmountField,
  CheckboxRow,
  ChipGroup,
  Field,
  InfoBanner,
  SaveButton,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { layout, palette } from '@/theme/theme';
import { CalendarPicker } from '@/components/CalendarPicker';
import { useStore } from '@/store/useStore';
import { sortAccounts } from '@/utils/sorting';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AddLoanScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { borrowerName: prefilledBorrower } = useLocalSearchParams<{ borrowerName?: string }>();

  const accounts = sortAccounts(useStore((s) => s.accounts).filter((a) => !a.deletedAt));
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

  const handleSave = async () => {
    if (!borrowerName.trim()) {
      Alert.alert('Name required', 'Please enter who owes you.');
      return;
    }
    if (!principal || principalNum <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount.');
      return;
    }
    if (!sourceAccountId) {
      Alert.alert('Select account', 'Please select which account this came out of.');
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
    <View style={styles.root}>
      <ScreenHeader
        title="Add IOU"
        paddingTop={isWeb ? 67 : insets.top + 10}
        onClose={() => router.back()}
        right={<SaveButton onPress={handleSave} disabled={saving} />}
      />

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingTop: layout.sectionGap,
          paddingBottom: (isWeb ? 34 : insets.bottom) + layout.sectionGap,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Owed By">
          <TextField
            placeholder="e.g. Kwame Mensah"
            value={borrowerName}
            onChangeText={setBorrowerName}
            autoFocus={!prefilledBorrower}
            returnKeyType="next"
          />
        </Field>

        <Field label="Amount">
          <AmountField value={principal} onChangeText={setPrincipal} />
        </Field>

        <Field label="From Account">
          <ChipGroup
            options={spendableAccounts.map((a) => ({ id: a.id, name: a.name }))}
            value={sourceAccountId}
            onSelect={setSourceAccountId}
            emptyText="No spendable accounts. Add one first."
          />
        </Field>

        <InfoBanner>
          This debits the account directly and won&apos;t show up as an expense — works the same
          whether it&apos;s a cash loan or something you paid for on someone&apos;s behalf.
        </InfoBanner>

        <Field label="Date">
          <CalendarPicker value={dateLent} onChange={setDateLent} maximumDate={new Date()} />
        </Field>

        <CheckboxRow
          checked={hasExpectedDate}
          onToggle={() => setHasExpectedDate((v) => !v)}
          label="Set an expected repayment date (optional)"
        />

        {hasExpectedDate && (
          <Field label="Expected Repayment Date">
            <CalendarPicker value={expectedRepaymentDate} onChange={setExpectedRepaymentDate} />
          </Field>
        )}

        <Field label="Note (optional)">
          <TextField placeholder="Add a note..." value={note} onChangeText={setNote} />
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
});
