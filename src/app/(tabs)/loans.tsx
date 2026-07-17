import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import {
  AmountText,
  Badge,
  Fab,
  FabSafeScrollView,
  GroupedList,
  Overline,
  PressFeedback,
  Row,
  useFabBottomOffset,
} from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { useStore } from '@/store/useStore';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { getLoanOutstanding, isLoanDueToday, isLoanOverdue } from '@/utils/calculations';
import type { Loan, LoanPayment } from '@/lib/types';

function lastActivityDate(loan: Loan, payments: LoanPayment[]): string {
  const paymentDates = payments.filter((p) => p.loanId === loan.id).map((p) => p.date);
  return [loan.dateLent, ...paymentDates].sort().at(-1)!;
}

export default function LoansScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const fabOffset = useFabBottomOffset();

  const loans = useStore((s) => s.loans);
  const loanPayments = useStore((s) => s.loanPayments);

  const activeLoans = loans.filter((l) => !l.settledAt);
  const settledLoans = loans.filter((l) => l.settledAt);

  const borrowerGroups = useMemo(() => {
    const names = Array.from(new Set(activeLoans.map((l) => l.borrowerName)));
    return names
      .map((borrowerName) => {
        const loansForBorrower = activeLoans.filter((l) => l.borrowerName === borrowerName);
        const totalOutstanding = loansForBorrower.reduce(
          (sum, l) => sum + getLoanOutstanding(l, loanPayments),
          0
        );
        return { borrowerName, loans: loansForBorrower, totalOutstanding };
      })
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [activeLoans, loanPayments]);

  const handleAdd = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-loan');
  };

  const goToBorrower = async (borrowerName: string) => {
    await Haptics.selectionAsync();
    router.push({ pathname: '/loan-detail', params: { borrowerName } });
  };

  // §4.4.2: amount + Overdue/Due Today badge line, caption metadata, then a
  // 4px repayment bar — at 0% the empty track itself communicates state.
  const LoanRow = ({ loan }: { loan: Loan }) => {
    const outstanding = getLoanOutstanding(loan, loanPayments);
    const repaidFraction = loan.principal > 0
      ? Math.min(1, Math.max(0, (loan.principal - outstanding) / loan.principal))
      : 0;
    const overdue = isLoanOverdue(loan, loanPayments);
    const dueToday = isLoanDueToday(loan, loanPayments);

    return (
      <PressFeedback style={styles.loanRow} onPress={() => goToBorrower(loan.borrowerName)}>
        <View style={styles.loanAmountLine}>
          <AmountText amount={outstanding} style={styles.loanAmount} />
          {overdue ? (
            <Badge label="Overdue" family="alert" icon="alert-circle" />
          ) : dueToday ? (
            <Badge label="Due Today" family="caution" icon="clock" />
          ) : null}
        </View>
        <Text style={[type.caption, styles.loanMeta]} numberOfLines={1}>
          Last activity {formatDateShort(lastActivityDate(loan, loanPayments))}
          {loan.expectedRepaymentDate ? ` · Due ${formatDateShort(loan.expectedRepaymentDate)}` : ''}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${repaidFraction * 100}%` }]} />
        </View>
      </PressFeedback>
    );
  };

  return (
    <View style={styles.root}>
      <FabSafeScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingTop: (isWeb ? 67 : insets.top) + layout.gapLg,
          paddingBottom: fabOffset + layout.listBottomPad,
        }}
      >
        <Text style={[type.title, styles.title]}>IOUs</Text>

        {borrowerGroups.length > 0 && <Overline style={styles.listLabel}>Active</Overline>}

        {/* §4.4.1: one GroupedList per person — avatar header row, then IOU rows. */}
        {borrowerGroups.map((group) => (
          <GroupedList key={group.borrowerName} style={styles.personGroup}>
            <PressFeedback
              style={styles.personHeader}
              onPress={() => goToBorrower(group.borrowerName)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {group.borrowerName.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[type.bodyBold, styles.personName]} numberOfLines={1}>
                {group.borrowerName}
              </Text>
              <AmountText amount={group.totalOutstanding} />
              <Feather name="chevron-right" size={layout.iconRow} color={palette.textMuted} />
            </PressFeedback>
            {group.loans.map((loan) => (
              <LoanRow key={loan.id} loan={loan} />
            ))}
          </GroupedList>
        ))}

        {borrowerGroups.length === 0 && (
          <View style={styles.empty}>
            <Feather name="users" size={24} color={palette.textMuted} />
            <Text style={type.body}>No active IOUs</Text>
            <Text style={[type.caption, styles.emptyDesc]}>
              Track money you’ve lent or borrowed
            </Text>
          </View>
        )}

        {settledLoans.length > 0 && (
          <>
            <Overline style={[styles.listLabel, styles.settledLabel]}>Settled</Overline>
            <GroupedList>
              {settledLoans.map((loan) => (
                <Row
                  key={loan.id}
                  title={loan.borrowerName}
                  subtitle={`${formatCurrency(loan.principal)} · settled ${formatDateShort(loan.settledAt!)}`}
                  right={
                    <Feather name="check-circle" size={layout.iconRow} color={palette.textMuted} />
                  }
                />
              ))}
            </GroupedList>
          </>
        )}
      </FabSafeScrollView>

      <Fab onPress={handleAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  title: {
    marginBottom: layout.sectionGap,
  },
  listLabel: {
    marginBottom: layout.gapSm,
  },
  settledLabel: {
    marginTop: layout.sectionGap,
  },
  personGroup: {
    marginBottom: layout.gapMd,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gapMd,
    minHeight: layout.rowHeight,
    paddingVertical: layout.rowPaddingV,
  },
  // §6: person avatars are the only icon circles in the app. The hairline
  // border keeps the surface-on-surface circle legible.
  avatar: {
    width: layout.avatar,
    height: layout.avatar,
    borderRadius: layout.radiusPill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: type.bodyBold.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.textSecondary,
  },
  personName: {
    flex: 1,
  },
  loanRow: {
    paddingVertical: layout.rowPaddingV,
    gap: 4,
  },
  loanAmountLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gapSm,
  },
  loanAmount: {
    textAlign: 'left',
  },
  loanMeta: {
    marginTop: 0,
  },
  progressTrack: {
    height: 4,
    borderRadius: layout.radiusPill,
    backgroundColor: palette.divider,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: layout.radiusPill,
    backgroundColor: palette.positive,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.sectionGap * 2,
    gap: layout.gapSm,
  },
  emptyDesc: {
    textAlign: 'center',
  },
});
