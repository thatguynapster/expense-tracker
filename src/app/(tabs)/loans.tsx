import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { formatCurrency, formatDateShort } from '@/utils/format';
import { getLoanOutstanding, isLoanOverdue } from '@/utils/calculations';
import type { Loan, LoanPayment } from '@/lib/types';

function lastActivityDate(loan: Loan, payments: LoanPayment[]): string {
  const paymentDates = payments.filter((p) => p.loanId === loan.id).map((p) => p.date);
  return [loan.dateLent, ...paymentDates].sort().at(-1)!;
}

export default function LoansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

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

  const LoanRow = ({ loan }: { loan: Loan }) => {
    const outstanding = getLoanOutstanding(loan, loanPayments);
    const repaidToDate = loan.principal - outstanding;
    const overdue = isLoanOverdue(loan, loanPayments);

    return (
      <View style={[styles.loanRow, { borderTopColor: colors.border }]}>
        <View style={styles.loanRowMain}>
          <Text style={[styles.loanPrincipal, { color: colors.foreground }]}>
            {formatCurrency(loan.principal)} lent · {formatCurrency(repaidToDate)} repaid
          </Text>
          <Text style={[styles.loanMeta, { color: colors.mutedForeground }]}>
            Last activity {formatDateShort(lastActivityDate(loan, loanPayments))}
            {loan.expectedRepaymentDate ? ` · Due ${formatDateShort(loan.expectedRepaymentDate)}` : ''}
          </Text>
        </View>
        <View style={styles.loanRowRight}>
          <Text style={[styles.loanOutstanding, { color: colors.foreground }]}>
            {formatCurrency(outstanding)}
          </Text>
          {overdue && (
            <View style={[styles.overdueBadge, { backgroundColor: colors.dangerBg }]}>
              <Text style={[styles.overdueBadgeText, { color: colors.danger }]}>Overdue</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: isWeb ? 67 + 16 : insets.top + 16,
            paddingBottom: isWeb ? 84 + 34 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Loans</Text>

        {borrowerGroups.length > 0 && (
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACTIVE</Text>
        )}

        {borrowerGroups.map((group) => (
          <TouchableOpacity
            key={group.borrowerName}
            style={[styles.borrowerCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => goToBorrower(group.borrowerName)}
            activeOpacity={0.8}
          >
            <View style={styles.borrowerHeader}>
              <View style={[styles.borrowerIcon, { backgroundColor: colors.muted }]}>
                <Feather name="user" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.borrowerName, { color: colors.foreground }]}>{group.borrowerName}</Text>
                <Text style={[styles.borrowerSub, { color: colors.mutedForeground }]}>
                  {group.loans.length} active loan{group.loans.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={[styles.borrowerTotal, { color: colors.foreground }]}>
                {formatCurrency(group.totalOutstanding)}
              </Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
            </View>

            {group.loans.map((loan) => (
              <LoanRow key={loan.id} loan={loan} />
            ))}
          </TouchableOpacity>
        ))}

        {borrowerGroups.length === 0 && (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="dollar-sign" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No active loans</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Track money you’ve lent out and when it’s due back
            </Text>
          </View>
        )}

        {settledLoans.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}>SETTLED</Text>
            {settledLoans.map((loan) => (
              <View
                key={loan.id}
                style={[styles.settledCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.borrowerName, { color: colors.foreground }]}>{loan.borrowerName}</Text>
                  <Text style={[styles.borrowerSub, { color: colors.mutedForeground }]}>
                    {formatCurrency(loan.principal)} · settled {formatDateShort(loan.settledAt!)}
                  </Text>
                </View>
                <Feather name="check-circle" size={18} color={colors.success} />
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: colors.primary, bottom: (isWeb ? 84 : insets.bottom + 80) + 8 },
        ]}
        onPress={handleAdd}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={26} color={colors.primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  borrowerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  borrowerHeader: { flexDirection: 'row', alignItems: 'center' },
  borrowerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  borrowerName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  borrowerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  borrowerTotal: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  loanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
  },
  loanRowMain: { flex: 1, marginRight: 12 },
  loanPrincipal: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  loanMeta: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  loanRowRight: { alignItems: 'flex-end' },
  loanOutstanding: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  overdueBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  overdueBadgeText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  settledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 10,
  },
  empty: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
});
