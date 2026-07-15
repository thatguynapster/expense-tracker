import React from 'react';
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
  useFabBottomOffset,
} from '@/components/ui';
import { layout, palette, type } from '@/theme/theme';
import { useStore } from '@/store/useStore';
import { sortAccounts } from '@/utils/sorting';
import type { Account } from '@/lib/types';

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const fabOffset = useFabBottomOffset();

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

  // Custom row (not <Row>): the Protected badge sits inline after the name,
  // and zero-balance accounts render present-but-quiet (§4.3.3).
  const AccountRow = ({ account }: { account: Account }) => {
    const isZero = account.balance === 0;
    return (
      <PressFeedback
        style={styles.accountRow}
        onPress={async () => {
          await Haptics.selectionAsync();
          router.push({ pathname: '/add-account', params: { id: account.id } });
        }}
      >
        <View style={styles.accountName}>
          <Text
            style={[type.rowTitle, isZero && { color: palette.textMuted }]}
            numberOfLines={1}
          >
            {account.name}
          </Text>
          {account.type === 'protected' && (
            <Badge label="Protected" family="caution" icon="shield" />
          )}
        </View>
        <AmountText amount={account.balance} color={isZero ? palette.textMuted : undefined} />
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
        <Text style={[type.title, styles.title]}>Accounts</Text>

        {/* §4.3.1: metric tiles — surface, no border, caption over 20px tabular. */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Text style={type.caption}>Spendable</Text>
            <AmountText
              amount={totalSpendable}
              size="title"
              color={palette.positive}
              style={styles.summaryAmount}
            />
          </View>
          <View style={styles.summaryTile}>
            <Text style={type.caption}>Protected</Text>
            <AmountText
              amount={totalProtected}
              size="title"
              color={palette.caution}
              style={styles.summaryAmount}
            />
          </View>
        </View>

        {accounts.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="credit-card" size={24} color={palette.textMuted} />
            <Text style={type.body}>No accounts yet</Text>
            <Text style={[type.caption, styles.emptyDesc]}>
              Add your first account to start tracking
            </Text>
          </View>
        ) : (
          <>
            <Overline style={styles.listLabel}>All accounts</Overline>
            <GroupedList>
              {accounts.map((account) => (
                <AccountRow key={account.id} account={account} />
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
  summaryRow: {
    flexDirection: 'row',
    gap: layout.gapMd,
    marginBottom: layout.sectionGap,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: layout.radiusContainer,
    padding: layout.gapLg,
  },
  summaryAmount: {
    textAlign: 'left',
    marginTop: 4,
  },
  listLabel: {
    marginBottom: layout.gapSm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gapMd,
    minHeight: layout.rowHeight,
    paddingVertical: layout.rowPaddingV,
  },
  accountName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.gapSm,
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
