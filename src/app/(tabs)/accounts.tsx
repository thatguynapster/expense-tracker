import React from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { formatCurrency } from '@/utils/format';
import { sortAccounts } from '@/utils/sorting';
import type { Account } from '@/lib/types';

export default function AccountsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const activeAccounts = useStore((s) => s.accounts).filter((a) => !a.deletedAt);
  const accounts = sortAccounts(activeAccounts);
  const spendable = accounts.filter((a) => a.type === 'spendable');
  const protected_ = accounts.filter((a) => a.type === 'protected');

  const totalSpendable = spendable.reduce((s, a) => s + a.balance, 0);
  const totalProtected = protected_.reduce((s, a) => s + a.balance, 0);

  const handleAdd = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-account');
  };

  const AccountRow = ({ account }: { account: Account }) => (
    <TouchableOpacity
      style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={async () => {
        await Haptics.selectionAsync();
        router.push({ pathname: '/add-account', params: { id: account.id } });
      }}
      activeOpacity={0.8}
    >
      <View style={[
        styles.accountIcon,
        { backgroundColor: account.type === 'protected' ? colors.warningBg : colors.muted }
      ]}>
        <Feather
          name={account.type === 'protected' ? 'shield' : 'briefcase'}
          size={18}
          color={account.type === 'protected' ? colors.warning : colors.primary}
        />
      </View>
      <View style={styles.accountInfo}>
        <Text style={[styles.accountName, { color: colors.foreground }]}>{account.name}</Text>
        <View style={[styles.typeBadge, {
          backgroundColor: account.type === 'protected' ? colors.warningBg : colors.muted
        }]}>
          <Text style={[styles.typeText, {
            color: account.type === 'protected' ? colors.warning : colors.primary
          }]}>
            {account.type === 'protected' ? 'Protected' : 'Spendable'}
          </Text>
        </View>
      </View>
      <Text style={[
        styles.accountBalance,
        { color: account.balance < 0 ? colors.danger : colors.foreground }
      ]}>
        {formatCurrency(account.balance)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: isWeb ? 67 + 16 : insets.top + 16,
            paddingBottom: isWeb ? 84 + 34 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Accounts</Text>

            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Spendable</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {formatCurrency(totalSpendable)}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Protected</Text>
                <Text style={[styles.summaryValue, { color: colors.warning }]}>
                  {formatCurrency(totalProtected)}
                </Text>
              </View>
            </View>

            {accounts.length > 0 && (
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                ALL ACCOUNTS
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="credit-card" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No accounts yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Add your first account to start tracking
            </Text>
          </View>
        }
        renderItem={({ item }) => <AccountRow account={item} />}
      />
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: (isWeb ? 84 : insets.bottom + 80) + 8,
          },
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
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  summaryValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1,
    marginBottom: 10,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  accountBalance: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  empty: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
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
