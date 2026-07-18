import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  AmountText,
  Badge,
  DestructiveButton,
  FabSafeScrollView,
  Field,
  GroupedList,
  Overline,
  PressFeedback,
  Row,
  ScreenHeader,
} from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { CalendarPicker } from '@/components/CalendarPicker';
import { useStore } from '@/store/useStore';
import { formatCurrency, formatDate } from '@/utils/format';
import { getLoanOutstanding, isLoanDueToday, isLoanOverdue } from '@/utils/calculations';
import type { Loan } from '@/lib/types';

type TimelineEntry =
  | { kind: 'disbursement'; date: string; amount: number; loanId: string }
  | { kind: 'repayment'; date: string; amount: number; loanId: string };

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function LoanDetailScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { borrowerName } = useLocalSearchParams<{ borrowerName: string }>();

  const loans = useStore((s) => s.loans);
  const loanPayments = useStore((s) => s.loanPayments);
  const markLoanSettled = useStore((s) => s.markLoanSettled);
  const updateLoanExpectedRepaymentDate = useStore((s) => s.updateLoanExpectedRepaymentDate);
  const deleteLoan = useStore((s) => s.deleteLoan);

  const [editingDateFor, setEditingDateFor] = useState<string | null>(null);

  const borrowerLoans = loans.filter((l) => l.borrowerName === borrowerName && !l.deletedAt);
  const activeLoans = borrowerLoans.filter((l) => !l.settledAt);
  const settledLoans = borrowerLoans.filter((l) => l.settledAt);
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + getLoanOutstanding(l, loanPayments), 0);

  const timeline: TimelineEntry[] = [
    ...borrowerLoans.map((l): TimelineEntry => ({ kind: 'disbursement', date: l.dateLent, amount: l.principal, loanId: l.id })),
    ...loanPayments
      .filter((p) => !p.deletedAt && borrowerLoans.some((l) => l.id === p.loanId))
      .map((p): TimelineEntry => ({ kind: 'repayment', date: p.date, amount: p.amount, loanId: p.loanId })),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (borrowerLoans.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={type.caption}>No IOUs found for this person.</Text>
      </View>
    );
  }

  const handleMarkSettled = async (loan: Loan) => {
    Alert.alert(
      'Mark as settled?',
      `This marks the amount owed by ${loan.borrowerName} as settled, regardless of remaining balance. This action is permanent and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Settled',
          style: 'destructive',
          onPress: async () => {
            // §5: delete/destructive confirm gets a Medium impact haptic at the tap itself.
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await markLoanSettled(loan.id);
          },
        },
      ]
    );
  };

  const handleDeleteLoan = async (loan: Loan) => {
    Alert.alert(
      'Delete IOU?',
      'This reverses the amount given, and any repayments already recorded against it, on your account balances. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // §5: delete/destructive confirm gets a Medium impact haptic at the tap itself.
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await deleteLoan(loan.id);
            if (!result.success) {
              Alert.alert('Error', result.error ?? 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  const handleAddLoan = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/add-loan', params: { borrowerName } });
  };

  const handleRepay = async (loanId: string) => {
    await Haptics.selectionAsync();
    router.push({ pathname: '/record-loan-repayment', params: { loanId } });
  };

  const LoanCard = ({ loan }: { loan: Loan }) => {
    const outstanding = getLoanOutstanding(loan, loanPayments);
    const overdue = isLoanOverdue(loan, loanPayments);
    const dueToday = isLoanDueToday(loan, loanPayments);
    const isEditingDate = editingDateFor === loan.id;

    return (
      <View style={styles.loanCard}>
        <View style={styles.loanCardRow}>
          <AmountText amount={loan.principal} size="title" style={styles.loanPrincipal} />
          {loan.settledAt ? (
            <Text style={[type.caption, styles.settledLabel]}>Settled</Text>
          ) : overdue ? (
            <Badge label="Overdue" family="alert" icon="alert-circle" />
          ) : dueToday ? (
            <Badge label="Due Today" family="caution" icon="clock" />
          ) : null}
        </View>

        <Text style={[type.caption, styles.loanMeta]}>Given {formatDate(loan.dateLent)}</Text>

        {!loan.settledAt && (
          <Text style={[type.bodyBold, styles.loanOutstanding]}>
            {formatCurrency(outstanding)} outstanding
          </Text>
        )}

        {loan.note && <Text style={[type.caption, styles.loanNote]}>{loan.note}</Text>}

        <Field
          label="Expected Repayment Date"
          right={
            !loan.settledAt && (
              <PressFeedback
                onPress={() => setEditingDateFor(isEditingDate ? null : loan.id)}
                style={styles.editDateBtn}
              >
                <Feather name="edit-2" size={14} color={palette.link} />
              </PressFeedback>
            )
          }
          style={styles.dateField}
        >
          {isEditingDate ? (
            <CalendarPicker
              value={loan.expectedRepaymentDate ? new Date(loan.expectedRepaymentDate) : new Date()}
              onChange={async (date) => {
                await updateLoanExpectedRepaymentDate(loan.id, dateToStr(date) + 'T00:00:00.000Z');
                setEditingDateFor(null);
              }}
            />
          ) : (
            <Text style={type.bodyBold}>
              {loan.expectedRepaymentDate ? formatDate(loan.expectedRepaymentDate) : 'Not set'}
            </Text>
          )}
        </Field>

        {!loan.settledAt && (
          <View style={styles.actionRow}>
            <PressFeedback
              baseColor={palette.link}
              pressedColor={palette.link}
              onPress={() => handleRepay(loan.id)}
              disabled={outstanding <= 0}
              style={[styles.actionBtn, outstanding <= 0 && styles.actionBtnDisabled]}
            >
              <Text style={styles.actionBtnText}>Record Repayment</Text>
            </PressFeedback>
            <PressFeedback
              baseColor={palette.surface}
              onPress={() => handleMarkSettled(loan)}
              style={styles.actionBtnSecondary}
            >
              <Text style={styles.actionBtnSecondaryText}>Mark Settled</Text>
            </PressFeedback>
          </View>
        )}

        <DestructiveButton label="Delete IOU" onPress={() => handleDeleteLoan(loan)} />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={borrowerName}
        paddingTop={isWeb ? 67 : insets.top + 10}
        onBack={() => router.back()}
      />

      <FabSafeScrollView contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: layout.sectionGap }}>
        <View style={styles.summaryCard}>
          <Text style={type.caption}>Total Outstanding</Text>
          <AmountText amount={totalOutstanding} size="title" style={styles.summaryAmount} />
        </View>

        <PressFeedback baseColor={palette.surface} onPress={handleAddLoan} style={styles.addLoanBtn}>
          <Feather name="plus" size={16} color={palette.link} style={styles.addLoanIcon} />
          <Text style={styles.addLoanBtnText}>Add Another IOU for {borrowerName}</Text>
        </PressFeedback>

        {activeLoans.length > 0 && <Overline style={styles.sectionLabel}>Active</Overline>}
        {activeLoans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} />
        ))}

        {settledLoans.length > 0 && (
          <>
            <Overline style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Settled</Overline>
            {settledLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </>
        )}

        <Overline style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Timeline</Overline>
        <GroupedList>
          {timeline.map((entry, i) => (
            <Row
              key={`${entry.kind}-${entry.loanId}-${i}`}
              icon={entry.kind === 'disbursement' ? 'arrow-up-right' : 'arrow-down-left'}
              iconTint={entry.kind === 'disbursement' ? palette.alert : palette.positive}
              title={entry.kind === 'disbursement' ? 'Given' : 'Repaid'}
              subtitle={formatDate(entry.date)}
              right={
                <AmountText
                  amount={entry.amount}
                  kind={entry.kind === 'disbursement' ? 'expense' : 'income'}
                />
              }
            />
          ))}
        </GroupedList>
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
    marginBottom: layout.sectionGap,
  },
  summaryAmount: {
    textAlign: 'center',
    marginTop: 4,
  },
  addLoanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.link,
    borderRadius: layout.radiusContainer,
    paddingVertical: 12,
    marginBottom: layout.sectionGap,
  },
  addLoanIcon: {
    marginRight: 6,
  },
  addLoanBtnText: {
    fontSize: type.bodyBold.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.link,
  },
  sectionLabel: {
    marginBottom: layout.gapSm,
  },
  sectionLabelSpaced: {
    marginTop: layout.gapSm,
  },
  loanCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapLg,
    marginBottom: layout.gapMd,
  },
  loanCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settledLabel: {
    color: palette.textMuted,
  },
  loanPrincipal: {
    textAlign: 'left',
  },
  loanMeta: {
    marginTop: 2,
  },
  loanOutstanding: {
    marginTop: layout.gapSm,
  },
  loanNote: {
    marginTop: layout.gapSm,
    fontStyle: 'italic',
  },
  dateField: {
    marginTop: layout.gapMd,
    marginBottom: 0,
  },
  editDateBtn: {
    padding: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: layout.gapSm,
    marginTop: layout.gapLg,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: palette.link,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    fontSize: type.section.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.canvas,
  },
  actionBtnSecondary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  actionBtnSecondaryText: {
    fontSize: type.section.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.textPrimary,
  },
});
