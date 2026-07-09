import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useStore } from "@/store/useStore";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AppInitializer({ children }: { children: React.ReactNode }) {
  const loadData = useStore((s) => s.loadData);
  const isLoaded = useStore((s) => s.isLoaded);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // A mutation's own syncNow() call only retries on the *next* mutation —
    // if the app was offline and the user doesn't touch it again for a
    // while, anything left dirty stays unsynced until they do. Retrying on
    // foreground closes that gap: coming back to the app (e.g. after
    // regaining connectivity) is as good a signal as any to try flushing
    // whatever's still pending.
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const cameToForeground = appState.current.match(/inactive|background/) && nextState === "active";
      appState.current = nextState;
      if (cameToForeground) {
        useStore.getState().syncNow();
      }
    });

    return () => subscription.remove();
  }, []);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add-transaction"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add-account"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add-loan"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="record-loan-repayment"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="loan-detail"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <AppInitializer>
                <RootLayoutNav />
              </AppInitializer>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
