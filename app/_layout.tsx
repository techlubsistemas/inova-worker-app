import { LockScreen } from "@/components/sync/LockScreen";
import { OfflineBanner } from "@/components/sync/OfflineBanner";
import { ServerOverwriteAlert } from "@/components/sync/ServerOverwriteAlert";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LocalAuthProvider, useLocalAuth } from "@/context/LocalAuthContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { StartedOrdersProvider } from "@/context/StartedOrdersContext";
import { SyncProvider } from "@/context/SyncContext";
import { WorkOrdersProvider } from "@/context/WorkOrdersContext";
import { ContextProvider } from "@/context/contextProvider";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import * as NavigationBar from "expo-navigation-bar";
import { Stack, usePathname, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";
import "react-native-reanimated";
import "../global.css";

function LockOverlay() {
  const { worker } = useAuth();
  const { state } = useLocalAuth();
  if (!worker) return null;
  if (state === "locked_pin" || state === "locked_biometric") {
    return <LockScreen />;
  }
  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { worker, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    const isPublicRoute = pathname === "/" || pathname === "/first-access";
    if (!worker && !isPublicRoute) {
      router.replace("/");
    }
  }, [isLoading, worker, pathname, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    // alias opcional: "PoppinsBold": Poppins_700Bold, etc.
  });

  useEffect(() => {
    if (Platform.OS === "android") {
      NavigationBar.setVisibilityAsync("hidden");
    }
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ContextProvider>
      <NetworkProvider>
      <AuthProvider>
        <AuthGuard>
        <SyncProvider>
        <LocalAuthProvider>
        <WorkOrdersProvider>
        <StartedOrdersProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen
              name="first-access"
              options={{ headerShown: false }}
            />

            <Stack.Screen name="home" options={{ headerShown: false }} />
            <Stack.Screen name="routes" options={{ headerShown: false }} />

            <Stack.Screen
              name="routeEquipment"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="startedRoute"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="route/[routeId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="order/[orderId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="order/[orderId]/complete"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="order/[orderId]/service/[cipServiceId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="order/[orderId]/service/[cipServiceId]/report-issue"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="loading"
              options={{ headerShown: false, animation: "fade" }}
            />
            <Stack.Screen name="sync" options={{ headerShown: false }} />
            <Stack.Screen
              name="profile/security"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="+not-found" />
          </Stack>
          <View
            style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 }}
            pointerEvents="box-none"
          >
            <OfflineBanner />
            <ServerOverwriteAlert />
          </View>
          <LockOverlay />
          <StatusBar style="auto" hidden />
        </ThemeProvider>
        </StartedOrdersProvider>
        </WorkOrdersProvider>
        </LocalAuthProvider>
        </SyncProvider>
        </AuthGuard>
      </AuthProvider>
      </NetworkProvider>
    </ContextProvider>
  );
}
