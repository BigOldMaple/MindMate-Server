import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Pressable, Text, StyleSheet, LogBox, AppState, AppStateStatus } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope } from 'expo-sensors';

// Prevent specific warnings from showing in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Configure notifications for Android
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const currentDate = new Date().toLocaleDateString('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

// Permission handler utility
const requestPermissions = async () => {
  try {
    // Request location and notification permissions
    const [locationPermission, notificationPermission] = await Promise.all([
      Location.requestForegroundPermissionsAsync(),
      Notifications.requestPermissionsAsync(),
    ]);

    // Initialize sensors
    await Accelerometer.setUpdateInterval(1000);
    await Gyroscope.setUpdateInterval(1000);
    
    // Start sensors to trigger Android permission dialog if needed
    const accelerometerSubscription = Accelerometer.addListener(() => {});
    const gyroscopeSubscription = Gyroscope.addListener(() => {});

    // Clean up sensor listeners
    accelerometerSubscription.remove();
    gyroscopeSubscription.remove();

    return {
      location: locationPermission.status === 'granted',
      notification: notificationPermission.status === 'granted',
      sensors: true // Sensors don't have a permission API, they trigger system dialog when used
    };
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return {
      location: false,
      notification: false,
      sensors: false
    };
  }
};

function RootLayoutNav() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const segments = useSegments();
  const { user, isLoading } = useAuth();
  const [appState, setAppState] = useState(AppState.currentState);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState !== nextAppState) {
      setAppState(nextAppState);
      if (nextAppState === 'active') {
        // Refresh permissions when app comes to foreground
        await requestPermissions();
      }
    }
  };

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: Colors[colorScheme ?? 'light'].background,
            },
            headerTintColor: Colors[colorScheme ?? 'light'].text,
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            headerLeft: () => (
              <Pressable 
                onPress={() => router.back()} 
                style={({ pressed }) => [
                  styles.headerButton,
                  pressed && styles.headerButtonPressed
                ]}
              >
                <Text style={[
                  styles.headerBackText,
                  { color: Colors[colorScheme ?? 'light'].text }
                ]}>
                  ←
                </Text>
              </Pressable>
            ),
          }}
        >
          <Stack.Screen
            name="(auth)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="notifications/index"
            options={{
              title: "Notifications",
              headerTitle: "Notifications",
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="profile/settings/index"
            options={{
              title: "Settings",
              headerTitle: "Settings",
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="community/create_community/index"
            options={{
              title: "Create Community",
              headerTitle: "Create Community",
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen
            name="home/check_in/index"
            options={{
              title: "Daily Check-in",
              headerTitle: "Daily Check-in",
              headerBackTitle: " ",
              headerTitleStyle: styles.headerTitle,
              headerShadowVisible: false,
              headerStyle: {
                backgroundColor: '#fff',
              },
              headerRight: () => (
                <Text style={styles.dateText}>{currentDate}</Text>
              ),
              animation: 'slide_from_bottom',
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });
  const [isReady, setIsReady] = useState(false);

  // Handle initialization errors
  useEffect(() => {
    if (error) {
      console.error('Error loading fonts:', error);
      // You might want to show an error screen here
    }
  }, [error]);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (loaded) {
          // Request permissions
          await requestPermissions();
          setIsReady(true);
          await SplashScreen.hideAsync();
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setIsReady(true); // Continue anyway to avoid app being stuck
        await SplashScreen.hideAsync();
      }
    };

    initializeApp();
  }, [loaded]);

  if (!loaded || !isReady) {
    return null;
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    marginLeft: 15,
    padding: 8,
    borderRadius: 8,
  },
  headerButtonPressed: {
    opacity: 0.7,
  },
  headerBackText: {
    fontSize: 24,
    marginRight: 4,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  dateText: {
    fontSize: 16,
    color: '#666',
    marginRight: 16,
  },
});