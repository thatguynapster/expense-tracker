import React from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import {
  AmountText,
  DestructiveButton,
  FabSafeScrollView,
  GroupedList,
  HeaderIconButton,
  InfoBanner,
  Overline,
  Row,
  ScreenHeader,
} from "@/components/ui";
import { layout, palette, type } from "@/theme/theme";
import { useStore } from "@/store/useStore";
import { formatCurrency, formatDate } from "@/utils/format";
import type { AmountKind } from "@/components/ui";

export default function TransactionDetailScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { id } = useLocalSearchParams<{ id: string }>();

  const transactions = useStore((s) => s.transactions);
  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const loans = useStore((s) => s.loans);
  const loanPayments = useStore((s) => s.loanPayments);
  const deleteTransaction = useStore((s) => s.deleteTransaction);

  const transaction = transactions.find((t) => t.id === id && !t.deletedAt);

  const accountName = (accountId: string | null | undefined) =>
    accounts.find((a) => a.id === accountId)?.name ?? "Unknown account";
  const categoryName = (categoryId: string | null | undefined) =>
    categories.find((c) => c.id === categoryId)?.name;

  // Covers all three shapes a loan can generate: the disbursement (loanId),
  // a repayment's credit, and a repayment's onward transfer leg (both
  // loanPaymentId). Any of these is locked from independent edit/delete —
  // only deleting the Loan/repayment itself (from the Loans tab) reverses it.
  const linkedLoan = transaction?.loanId
    ? loans.find((l) => l.id === transaction.loanId)
    : transaction?.loanPaymentId
      ? loans.find((l) => l.id === loanPayments.find((p) => p.id === transaction.loanPaymentId)?.loanId)
      : undefined;
  const isLoanLinked = !!transaction?.loanId || !!transaction?.loanPaymentId;

  // The forced-savings transfer leg of an income is locked the same way a
  // loan-linked transaction is — only deleting/editing the primary income
  // transaction (which cascades to this one, see deleteTransaction) changes
  // it. The primary income transaction stays normally editable/deletable;
  // it just also gets a "View" link forward to its transfer leg, if any.
  const isIncomeLinked = !!transaction?.incomeTransactionId;
  const linkedIncomeTransaction = transaction?.incomeTransactionId
    ? transactions.find((t) => t.id === transaction.incomeTransactionId && !t.deletedAt)
    : undefined;
  const linkedSavingsTransfer =
    transaction && !isIncomeLinked
      ? transactions.find((t) => t.incomeTransactionId === transaction.id && !t.deletedAt)
      : undefined;

  const handleEdit = async () => {
    await Haptics.selectionAsync();
    router.push({ pathname: "/add-transaction", params: { id } });
  };

  const handleViewLoan = async () => {
    if (!linkedLoan) return;
    await Haptics.selectionAsync();
    router.push({ pathname: "/loan-detail", params: { borrowerName: linkedLoan.borrowerName } });
  };

  const handleViewTransaction = async (targetId: string) => {
    await Haptics.selectionAsync();
    router.push({ pathname: "/transaction-detail", params: { id: targetId } });
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Transaction",
      "This reverses its effect on your account balances and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // §5: delete confirm gets a Medium impact haptic at the tap itself,
            // not a success notification after the fact.
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const result = await deleteTransaction(id);
            if (!result.success) {
              Alert.alert("Error", result.error ?? "Failed to delete.");
              return;
            }
            router.back();
          },
        },
      ],
    );
  };

  if (!transaction) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={type.caption}>Transaction not found.</Text>
      </View>
    );
  }

  const isIncome = transaction.type === "income";
  const isExpense = transaction.type === "expense";
  const isTransfer = transaction.type === "transfer";
  const isAdjustment = transaction.type === "adjustment";
  const isLoanDisbursement = transaction.type === "loan_disbursement";
  const isLoanRepayment = transaction.type === "loan_repayment";
  const amountKind: AmountKind = isIncome || isLoanRepayment
    ? "income"
    : isExpense || isLoanDisbursement
      ? "expense"
      : isAdjustment
        ? transaction.toAccountId
          ? "income"
          : "expense"
        : "transfer";
  const typeLabel = isIncome
    ? "Income"
    : isExpense
      ? "Expense"
      : isAdjustment
        ? "Balance Adjustment"
        : isLoanDisbursement
          ? "Loan Given"
          : isLoanRepayment
            ? "Loan Repaid"
            : "Transfer";

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={typeLabel}
        paddingTop={isWeb ? 67 : insets.top + 10}
        onBack={() => router.back()}
        // Adjustments are delete-and-recreate only — no edit screen for
        // them. Loan-linked transactions (disbursement, repayment, and its
        // onward transfer leg) are managed entirely from the Loans tab. An
        // income's forced-savings transfer leg is managed by editing/
        // deleting the income transaction it split off from.
        right={
          isAdjustment || isLoanLinked || isIncomeLinked ? undefined : (
            <HeaderIconButton icon="edit-2" onPress={handleEdit} />
          )
        }
      />

      <FabSafeScrollView
        contentContainerStyle={{
          paddingHorizontal: layout.gutter,
          paddingTop: layout.sectionGap,
        }}
      >
        <View style={styles.summaryCard}>
          <AmountText
            amount={transaction.amount}
            kind={amountKind}
            size="title"
            style={styles.summaryAmount}
          />
          <Text style={[type.caption, styles.summaryDate]}>
            {formatDate(transaction.date)}
          </Text>
        </View>

        <GroupedList style={styles.section}>
          {isExpense && (
            <>
              <Row
                title="Account"
                right={
                  <Text style={type.body}>
                    {accountName(transaction.fromAccountId)}
                  </Text>
                }
              />
              {categoryName(transaction.categoryId) && (
                <Row
                  title="Category"
                  right={
                    <Text style={type.body}>
                      {categoryName(transaction.categoryId)}
                    </Text>
                  }
                />
              )}
            </>
          )}

          {isIncome && (
            <>
              <Row
                title="Deposited Into"
                right={
                  <Text style={type.body}>
                    {accountName(transaction.toAccountId)}
                  </Text>
                }
              />
              {/* Old shape only — current income transactions move the
                  forced-savings portion via a separate linked transfer
                  (see the "Savings Transfer" row below), so savingsAccountId
                  is null on anything created after that change. */}
              {transaction.savingsAccountId && (
                <Row
                  title="Saved Into"
                  right={
                    <Text style={type.body}>
                      {accountName(transaction.savingsAccountId)}
                    </Text>
                  }
                />
              )}
              <Row
                title="Savings Amount"
                right={<AmountText amount={transaction.savingsAmount ?? 0} />}
              />
              {categoryName(transaction.categoryId) && (
                <Row
                  title="Category"
                  right={
                    <Text style={type.body}>
                      {categoryName(transaction.categoryId)}
                    </Text>
                  }
                />
              )}
            </>
          )}

          {isTransfer && (
            <>
              <Row
                title="From"
                right={
                  <Text style={type.body}>
                    {accountName(transaction.fromAccountId)}
                  </Text>
                }
              />
              <Row
                title="To"
                right={
                  <Text style={type.body}>
                    {accountName(transaction.toAccountId)}
                  </Text>
                }
              />
              {transaction.reason && (
                <Row
                  title="Reason"
                  right={<Text style={type.body}>{transaction.reason}</Text>}
                />
              )}
              {transaction.countsAsDebtRepayment && (
                <Row
                  title="Discipline Debt"
                  right={<Text style={type.body}>Counted as repayment</Text>}
                />
              )}
              {linkedLoan && (
                <Row
                  title="Borrower"
                  right={<Text style={type.body}>{linkedLoan.borrowerName}</Text>}
                />
              )}
            </>
          )}

          {isLoanDisbursement && (
            <>
              <Row
                title="Account"
                right={
                  <Text style={type.body}>
                    {accountName(transaction.fromAccountId)}
                  </Text>
                }
              />
              {linkedLoan && (
                <Row
                  title="Borrower"
                  right={<Text style={type.body}>{linkedLoan.borrowerName}</Text>}
                />
              )}
            </>
          )}

          {isLoanRepayment && (
            <>
              <Row
                title="Credited To"
                right={
                  <Text style={type.body}>
                    {accountName(transaction.toAccountId)}
                  </Text>
                }
              />
              {linkedLoan && (
                <Row
                  title="Borrower"
                  right={<Text style={type.body}>{linkedLoan.borrowerName}</Text>}
                />
              )}
            </>
          )}

          {isAdjustment && (
            <Row
              title="Account"
              right={
                <Text style={type.body}>
                  {accountName(
                    transaction.fromAccountId ?? transaction.toAccountId,
                  )}
                </Text>
              }
            />
          )}
        </GroupedList>

        {transaction.note && (
          <View style={[styles.section, styles.noteCard]}>
            <Overline style={styles.noteLabel}>Note</Overline>
            <Text style={type.body}>{transaction.note}</Text>
          </View>
        )}

        {isLoanLinked || isIncomeLinked ? (
          <View style={styles.section}>
            <InfoBanner>
              {isLoanLinked
                ? "This transaction is generated by a loan and can only be changed from the Loans tab."
                : "This transaction is the forced-savings portion of an income entry and can only be changed by editing or deleting that income."}
            </InfoBanner>
            {linkedLoan && (
              <GroupedList>
                <Row
                  icon="dollar-sign"
                  title="View Loan"
                  subtitle={linkedLoan.borrowerName}
                  chevron
                  onPress={handleViewLoan}
                />
              </GroupedList>
            )}
            {linkedIncomeTransaction && (
              <GroupedList>
                <Row
                  icon="arrow-down-circle"
                  title="View Income"
                  subtitle={formatCurrency(linkedIncomeTransaction.amount)}
                  chevron
                  onPress={() => handleViewTransaction(linkedIncomeTransaction.id)}
                />
              </GroupedList>
            )}
          </View>
        ) : (
          <>
            {linkedSavingsTransfer && (
              <GroupedList style={styles.section}>
                <Row
                  icon="repeat"
                  title="Savings Transfer"
                  subtitle={accountName(linkedSavingsTransfer.toAccountId)}
                  chevron
                  onPress={() => handleViewTransaction(linkedSavingsTransfer.id)}
                />
              </GroupedList>
            )}
            <DestructiveButton label="Delete Transaction" onPress={handleDelete} />
          </>
        )}
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
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusHero,
    padding: 20,
    alignItems: "center",
  },
  summaryAmount: {
    textAlign: "center",
  },
  summaryDate: {
    marginTop: 6,
  },
  section: {
    marginTop: layout.sectionGap,
  },
  noteCard: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapMd,
  },
  noteLabel: {
    marginBottom: layout.gapSm,
  },
});
