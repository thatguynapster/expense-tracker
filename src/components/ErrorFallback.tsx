import { Feather } from "@expo/vector-icons";
import { reloadAppAsync } from "expo";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { layout, palette, type } from "@/theme/theme";
import { PressFeedback } from "@/components/ui";

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const insets = useSafeAreaInsets();

  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error("Failed to restart app:", restartError);
      resetError();
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  const monoFont = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  });

  return (
    <View style={styles.container}>
      {__DEV__ ? (
        <Pressable
          onPress={() => setIsModalVisible(true)}
          accessibilityLabel="View error details"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.topButton,
            { top: insets.top + 16, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="alert-circle" size={20} color={palette.textPrimary} />
        </Pressable>
      ) : null}

      <View style={styles.content}>
        <Text style={styles.title}>Something went wrong</Text>

        <Text style={[type.body, styles.message]}>Please reload the app to continue.</Text>

        <PressFeedback baseColor={palette.link} pressedColor={palette.link} onPress={handleRestart} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </PressFeedback>
      </View>

      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={type.header}>Error Details</Text>
                <Pressable
                  onPress={() => setIsModalVisible(false)}
                  accessibilityLabel="Close error details"
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Feather name="x" size={24} color={palette.textPrimary} />
                </Pressable>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={[styles.modalScrollContent, { paddingBottom: insets.bottom + 16 }]}
                showsVerticalScrollIndicator
              >
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorText, { fontFamily: monoFont }]} selectable>
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: palette.canvas,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: layout.gapLg,
    width: "100%",
    maxWidth: 600,
  },
  title: {
    fontSize: type.title.fontSize,
    fontFamily: type.title.fontFamily,
    color: palette.textPrimary,
    textAlign: "center",
    lineHeight: 32,
  },
  message: {
    textAlign: "center",
    lineHeight: 22,
  },
  topButton: {
    position: "absolute",
    right: 16,
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    backgroundColor: palette.surface,
  },
  button: {
    paddingVertical: 16,
    borderRadius: layout.radiusContainer,
    paddingHorizontal: 24,
    minWidth: 200,
  },
  buttonText: {
    fontSize: type.bodyBold.fontSize,
    fontFamily: type.bodyBold.fontFamily,
    color: palette.canvas,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    width: "100%",
    height: "90%",
    borderTopLeftRadius: layout.radiusHero,
    borderTopRightRadius: layout.radiusHero,
    backgroundColor: palette.canvas,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.hairline,
  },
  closeButton: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  errorContainer: {
    width: "100%",
    borderRadius: layout.radiusContainer,
    overflow: "hidden",
    padding: 16,
    backgroundColor: palette.surface,
  },
  errorText: {
    fontSize: type.caption.fontSize,
    color: palette.textPrimary,
    lineHeight: 18,
    width: "100%",
  },
});
