import { AuthProvider, useAuth } from "@/context/AuthContext";
import { StartedOrdersProvider } from "@/context/StartedOrdersContext";
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
import { Platform } from "react-native";
import "react-native-reanimated";
import "../global.css";

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
      <AuthProvider>
        <AuthGuard>
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
            <Stack.Screen name="+not-found" />
          </Stack>
          <StatusBar style="auto" hidden />
        </ThemeProvider>
        </StartedOrdersProvider>
        </AuthGuard>
      </AuthProvider>
    </ContextProvider>
  );
}
