import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import {
  AmountField,
  ChipGroup,
  Field,
  InfoBanner,
  SaveButton,
  ScreenHeader,
  TextField,
} from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
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
      <View style={[styles.root, styles.centered]}>
        <Text style={type.caption}>Loan not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Record Repayment"
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
        <View style={styles.summaryBox}>
          <Text style={type.bodyBold}>{loan.borrowerName}</Text>
          <Text style={[type.caption, styles.summaryOutstanding]}>
            Outstanding: {formatCurrency(outstanding)}
          </Text>
        </View>

        <Field label="Amount">
          <AmountField value={amount} onChangeText={setAmount} autoFocus />
          {amountNum > outstanding && (
            <Text style={[type.caption, styles.validationError]}>
              Cannot exceed the outstanding balance ({formatCurrency(outstanding)}).
            </Text>
          )}
        </Field>

        <Field label="Received Into">
          <ChipGroup
            options={accounts.map((a) => ({ id: a.id, name: a.name }))}
            value={destinationAccountId}
            onSelect={setDestinationAccountId}
          />
        </Field>

        <InfoBanner>
          Repayments always credit
          {sourceAccount ? ` ${sourceAccount.name}` : ' the account this was originally given from'}, so
          its balance recovers regardless of where you actually received the cash. &quot;Received
          Into&quot; is just a record — it won&apos;t affect that account&apos;s balance. This won&apos;t
          show up as income.
        </InfoBanner>

        <Field label="Date">
          <CalendarPicker value={date} onChange={setDate} maximumDate={new Date()} />
        </Field>

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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBox: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapLg,
    marginBottom: layout.sectionGap,
  },
  summaryOutstanding: {
    marginTop: 4,
  },
  validationError: {
    color: palette.alert,
    marginTop: layout.gapSm,
  },
});
