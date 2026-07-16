import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import {
  AmountField,
  AmountText,
  Field,
  SaveButton,
  ScreenHeader,
  TextField,
} from "@/components/ui";
import { layout, palette, type } from "@/theme/theme";
import { CalendarPicker } from "@/components/CalendarPicker";
import { useStore } from "@/store/useStore";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

function dateToStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Direction = "add" | "subtract";

export default function AddAdjustmentScreen() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { accountId } = useLocalSearchParams<{ accountId: string }>();

  const accounts = useStore((s) => s.accounts);
  const addAdjustment = useStore((s) => s.addAdjustment);
  const account = accounts.find((a) => a.id === accountId);

  const [direction, setDirection] = useState<Direction>("add");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date());
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount) || 0;

  const handleSave = async () => {
    if (!amount || amountNum <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid amount.");
      return;
    }
    if (!note.trim()) {
      Alert.alert(
        "Note required",
        "Add a short note explaining this correction.",
      );
      return;
    }

    setSaving(true);
    try {
      const result = await addAdjustment({
        accountId,
        delta: direction === "add" ? amountNum : -amountNum,
        date: dateToStr(date) + "T00:00:00.000Z",
        note: note.trim(),
      });
      if (!result.success) {
        Alert.alert("Error", result.error ?? "Failed to save.");
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!account) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={type.caption}>Account not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Adjust Balance"
        paddingTop={isWeb ? 67 : insets.top + 10}
        onClose={() => router.back()}
        right={<SaveButton onPress={handleSave} disabled={saving} />}
      />

      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (isWeb ? 34 : insets.bottom) + layout.sectionGap },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryBox}>
          <Text style={type.bodyBold}>{account.name}</Text>
          <View style={styles.currentBalanceRow}>
            <Text style={type.caption}>Current balance</Text>
            <AmountText amount={account.balance} />
          </View>
        </View>

        <View style={styles.directionTabs}>
          {(["add", "subtract"] as Direction[]).map((d) => {
            const selected = direction === d;
            return (
              <Pressable
                key={d}
                style={[
                  styles.directionTab,
                  selected && styles.directionTabSelected,
                ]}
                onPress={() => setDirection(d)}
              >
                <Text
                  style={[
                    styles.directionTabText,
                    selected && styles.directionTabTextSelected,
                  ]}
                >
                  {d === "add" ? "Add" : "Subtract"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Field label="Amount">
          <AmountField value={amount} onChangeText={setAmount} autoFocus />
        </Field>

        <Field label="Note">
          <TextField
            placeholder="Why does this need correcting?"
            value={note}
            onChangeText={setNote}
          />
        </Field>

        <Field label="Date">
          <CalendarPicker
            value={date}
            onChange={setDate}
            maximumDate={new Date()}
          />
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
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: layout.gutter,
    paddingTop: layout.sectionGap,
  },
  summaryBox: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.hairline,
    borderRadius: layout.radiusContainer,
    padding: layout.gapLg,
    marginBottom: layout.sectionGap,
    gap: layout.gapSm,
  },
  currentBalanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  directionTabs: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderRadius: layout.radiusContainer,
    padding: 4,
    marginBottom: layout.sectionGap,
  },
  directionTab: {
    flex: 1,
    paddingVertical: layout.gapSm,
    borderRadius: 10,
    alignItems: "center",
  },
  directionTabSelected: {
    backgroundColor: palette.surfaceRaised,
  },
  directionTabText: {
    fontSize: type.body.fontSize,
    fontFamily: type.caption.fontFamily,
    color: palette.textSecondary,
  },
  directionTabTextSelected: {
    fontFamily: type.bodyBold.fontFamily,
    color: palette.textPrimary,
  },
});
