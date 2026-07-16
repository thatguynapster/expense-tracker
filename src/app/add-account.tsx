import React, { useEffect, useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import {
  AmountField,
  DestructiveButton,
  Field,
  GroupedList,
  InfoBanner,
  PressFeedback,
  Row,
  SaveButton,
  ScreenHeader,
  TextField,
} from "@/components/ui";
import { layout, palette, type } from "@/theme/theme";
import { useStore } from "@/store/useStore";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

export default function AddAccountScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { id } = useLocalSearchParams<{ id?: string }>();

  const accounts = useStore((s) => s.accounts);
  const transactions = useStore((s) => s.transactions);
  const loans = useStore((s) => s.loans);
  const loanPayments = useStore((s) => s.loanPayments);
  const addAccount = useStore((s) => s.addAccount);
  const updateAccount = useStore((s) => s.updateAccount);
  const deleteAccount = useStore((s) => s.deleteAccount);

  const isEditing = !!id;
  const existing = accounts.find((a) => a.id === id);

  const [name, setName] = useState("");
  const [type_, setType_] = useState<"spendable" | "protected">("spendable");
  const [initialBalance, setInitialBalance] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setType_(existing.type);
    }
  }, [existing?.id]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter an account name.");
      return;
    }
    setSaving(true);
    try {
      if (isEditing && id) {
        await updateAccount(id, name.trim());
      } else {
        await addAccount(name.trim(), type_, parseFloat(initialBalance) || 0);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !existing) return;
    const isUsed =
      transactions.some(
        (t) =>
          t.fromAccountId === id ||
          t.toAccountId === id ||
          t.savingsAccountId === id,
      ) ||
      loans.some((l) => l.sourceAccountId === id) ||
      loanPayments.some((p) => p.destinationAccountId === id);

    if (isUsed) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        "Cannot Delete",
        `${existing.name} has existing transactions or IOU activity and cannot be deleted.`,
      );
      return;
    }

    Alert.alert(
      "Delete Account",
      `Delete ${existing.name}? This action is permanent and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            // §5: delete confirm gets a Medium impact haptic at the tap itself.
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteAccount(id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={isEditing ? "Edit Account" : "Add Account"}
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
        <Field label="Account Name">
          <TextField
            placeholder="e.g. Salary Account, Mobile Money"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
          />
        </Field>

        {!isEditing && (
          <Field label="Account Type">
            <View style={styles.typeOptions}>
              <TypeCard
                selected={type_ === "spendable"}
                onPress={() => setType_("spendable")}
                icon="briefcase"
                accent={palette.link}
                name="Spendable"
                description="Salary, cash, mobile money. Counts toward Safe-to-Spend."
              />
              <TypeCard
                selected={type_ === "protected"}
                onPress={() => setType_("protected")}
                icon="shield"
                accent={palette.caution}
                name="Protected"
                description="Savings, emergency fund. Excluded from Safe-to-Spend."
              />
            </View>
          </Field>
        )}

        {!isEditing && (
          <Field label="Starting Balance (optional)">
            <AmountField
              value={initialBalance}
              onChangeText={setInitialBalance}
            />
          </Field>
        )}

        {isEditing && (
          <InfoBanner>
            Account type cannot be changed after creation. Only the name can be
            edited.
          </InfoBanner>
        )}

        {isEditing && id && (
          <GroupedList style={styles.adjustList}>
            <Row
              icon="sliders"
              title="Adjust Balance"
              subtitle="Correct for interest, fees, or a miscount"
              chevron
              onPress={() =>
                router.push({
                  pathname: "/add-adjustment",
                  params: { accountId: id },
                })
              }
            />
          </GroupedList>
        )}

        {isEditing && (
          <DestructiveButton label="Delete Account" onPress={handleDelete} />
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function TypeCard({
  selected,
  onPress,
  icon,
  accent,
  name,
  description,
}: {
  selected: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Feather>["name"];
  accent: string;
  name: string;
  description: string;
}) {
  return (
    <PressFeedback
      baseColor={palette.surface}
      onPress={onPress}
      style={[styles.typeCard, selected && { borderColor: accent }]}
    >
      <Feather
        name={icon}
        size={20}
        color={selected ? accent : palette.textSecondary}
      />
      <Text style={[type.bodyBold, selected && { color: accent }]}>{name}</Text>
      <Text style={[type.caption, styles.typeDesc]}>{description}</Text>
    </PressFeedback>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  adjustList: {
    marginBottom: layout.sectionGap,
  },
  typeOptions: {
    gap: layout.gapMd,
  },
  typeCard: {
    padding: layout.gapLg,
    borderRadius: layout.radiusContainer,
    borderWidth: 1,
    borderColor: palette.hairline,
    gap: layout.gapSm,
    alignItems: "flex-start",
  },
  typeDesc: {
    lineHeight: 17,
  },
});
