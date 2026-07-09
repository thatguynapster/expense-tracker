import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { CalendarPicker } from '@/components/CalendarPicker';
import { useStore } from '@/store/useStore';
import { formatCurrency, formatDate } from '@/utils/format';
import { getLoanOutstanding, isLoanOverdue } from '@/utils/calculations';
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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const { borrowerName } = useLocalSearchParams<{ borrowerName: string }>();

  const loans = useStore((s) => s.loans);
  const loanPayments = useStore((s) => s.loanPayments);
  const markLoanSettled = useStore((s) => s.markLoanSettled);
  const updateLoanExpectedRepaymentDate = useStore((s) => s.updateLoanExpectedRepaymentDate);

  const [editingDateFor, setEditingDateFor] = useState<string | null>(null);

  const borrowerLoans = loans.filter((l) => l.borrowerName === borrowerName);
  const activeLoans = borrowerLoans.filter((l) => !l.settledAt);
  const settledLoans = borrowerLoans.filter((l) => l.settledAt);
  const totalOutstanding = activeLoans.reduce((sum, l) => sum + getLoanOutstanding(l, loanPayments), 0);

  const timeline: TimelineEntry[] = [
    ...borrowerLoans.map((l): TimelineEntry => ({ kind: 'disbursement', date: l.dateLent, amount: l.principal, loanId: l.id })),
    ...loanPayments
      .filter((p) => borrowerLoans.some((l) => l.id === p.loanId))
      .map((p): TimelineEntry => ({ kind: 'repayment', date: p.date, amount: p.amount, loanId: p.loanId })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (borrowerLoans.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.mutedForeground }}>No loans found for this borrower.</Text>
      </View>
    );
  }

  const handleMarkSettled = async (loan: Loan) => {
    Alert.alert(
      'Mark as settled?',
      `This marks the loan to ${loan.borrowerName} as settled, regardless of remaining balance. This action is permanent and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Settled',
          style: 'destructive',
          onPress: async () => {
            await markLoanSettled(loan.id);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    const isEditingDate = editingDateFor === loan.id;

    return (
      <View style={[styles.loanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.loanCardRow}>
          <Text style={[styles.loanPrincipal, { color: colors.foreground }]}>
            {formatCurrency(loan.principal)}
          </Text>
          {loan.settledAt ? (
            <View style={[styles.settledBadge, { backgroundColor: colors.successBg }]}>
              <Text style={[styles.settledBadgeText, { color: colors.success }]}>Settled</Text>
            </View>
          ) : overdue ? (
            <View style={[styles.overdueBadge, { backgroundColor: colors.dangerBg }]}>
              <Text style={[styles.overdueBadgeText, { color: colors.danger }]}>Overdue</Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.loanMeta, { color: colors.mutedForeground }]}>
          Lent {formatDate(loan.dateLent)}
        </Text>

        {!loan.settledAt && (
          <Text style={[styles.loanOutstanding, { color: colors.foreground }]}>
            {formatCurrency(outstanding)} outstanding
          </Text>
        )}

        {loan.note && (
          <Text style={[styles.loanNote, { color: colors.mutedForeground }]}>{loan.note}</Text>
        )}

        <View style={styles.fieldGroup}>
          <View style={styles.dateRow}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Expected Repayment Date</Text>
            {!loan.settledAt && (
              <TouchableOpacity onPress={() => setEditingDateFor(isEditingDate ? null : loan.id)}>
                <Feather name="edit-2" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          {isEditingDate ? (
            <CalendarPicker
              value={loan.expectedRepaymentDate ? new Date(loan.expectedRepaymentDate) : new Date()}
              onChange={async (date) => {
                await updateLoanExpectedRepaymentDate(loan.id, dateToStr(date) + 'T00:00:00.000Z');
                setEditingDateFor(null);
              }}
            />
          ) : (
            <Text style={[styles.dateValue, { color: colors.foreground }]}>
              {loan.expectedRepaymentDate ? formatDate(loan.expectedRepaymentDate) : 'Not set'}
            </Text>
          )}
        </View>

        {!loan.settledAt && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleRepay(loan.id)}
              disabled={outstanding <= 0}
            >
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>
                Record Repayment
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtnSecondary, { borderColor: colors.border }]}
              onPress={() => handleMarkSettled(loan)}
            >
              <Text style={[styles.actionBtnSecondaryText, { color: colors.foreground }]}>
                Mark Settled
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[
        styles.header,
        { paddingTop: isWeb ? 67 : insets.top + 10, backgroundColor: colors.background, borderBottomColor: colors.border },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {borrowerName}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total Outstanding</Text>
          <Text style={[styles.summaryValue, { color: colors.foreground }]}>
            {formatCurrency(totalOutstanding)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addLoanBtn, { borderColor: colors.primary }]}
          onPress={handleAddLoan}
        >
          <Feather name="plus" size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.addLoanBtnText, { color: colors.primary }]}>Lend {borrowerName} More</Text>
        </TouchableOpacity>

        {activeLoans.length > 0 && (
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIVE LOANS</Text>
        )}
        {activeLoans.map((loan) => (
          <LoanCard key={loan.id} loan={loan} />
        ))}

        {settledLoans.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
              SETTLED LOANS
            </Text>
            {settledLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </>
        )}

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
          TIMELINE
        </Text>
        {timeline.map((entry, i) => (
          <View
            key={`${entry.kind}-${entry.loanId}-${i}`}
            style={[styles.timelineRow, { borderColor: colors.border }]}
          >
            <View style={[
              styles.timelineIcon,
              { backgroundColor: entry.kind === 'disbursement' ? colors.dangerBg : colors.successBg },
            ]}>
              <Feather
                name={entry.kind === 'disbursement' ? 'arrow-up-right' : 'arrow-down-left'}
                size={14}
                color={entry.kind === 'disbursement' ? colors.danger : colors.success}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.timelineLabel, { color: colors.foreground }]}>
                {entry.kind === 'disbursement' ? 'Lent' : 'Repaid'}
              </Text>
              <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>
                {formatDate(entry.date)}
              </Text>
            </View>
            <Text style={[
              styles.timelineAmount,
              { color: entry.kind === 'disbursement' ? colors.danger : colors.success },
            ]}>
              {entry.kind === 'disbursement' ? '-' : '+'}{formatCurrency(entry.amount)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  summaryValue: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  addLoanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  addLoanBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  sectionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1, marginBottom: 10 },
  loanCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  loanCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loanPrincipal: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  loanMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  loanOutstanding: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  loanNote: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8, fontStyle: 'italic' },
  overdueBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  overdueBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  settledBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  settledBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  fieldGroup: { marginTop: 14 },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3, textTransform: 'uppercase' },
  dateValue: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  actionBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  actionBtnSecondary: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1 },
  actionBtnSecondaryText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timelineLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  timelineDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  timelineAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
