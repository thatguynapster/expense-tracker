import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStore } from '@/store/useStore';
import { TransactionItem } from '@/components/TransactionItem';
import { formatDate } from '@/utils/format';

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  const accounts = useStore((s) => s.accounts);
  const categories = useStore((s) => s.categories);
  const transactions = useStore((s) => s.transactions);

  const sorted = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [transactions]
  );

  const grouped = useMemo(() => {
    const groups: { date: string; transactions: typeof sorted }[] = [];
    const seen = new Map<string, typeof sorted>();
    for (const tx of sorted) {
      const day = tx.date.split('T')[0] ?? tx.date;
      if (!seen.has(day)) {
        seen.set(day, []);
        groups.push({ date: day, transactions: seen.get(day)! });
      }
      seen.get(day)!.push(tx);
    }
    return groups;
  }, [sorted]);

  const handleAdd = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/add-transaction');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.date}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: isWeb ? 67 + 16 : insets.top + 16,
            paddingBottom: isWeb ? 84 + 34 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={grouped.length > 0}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Transactions</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="list" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No transactions yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tap the + button to record your first transaction
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
              {formatDate(item.date + 'T00:00:00.000Z')}
            </Text>
            {item.transactions.map((tx) => (
              <TransactionItem
                key={tx.id}
                transaction={tx}
                accounts={accounts}
                categories={categories}
              />
            ))}
          </View>
        )}
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
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  dateLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
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
