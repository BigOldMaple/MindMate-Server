import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { Pressable, Text, StyleSheet, LogBox, AppState, AppStateStatus, Alert, Platform } from 'react-native';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';
import { registerBackgroundStepTracking } from '@/services/backgroundStepService';
import * as TaskManager from 'expo-task-manager';
import * as Linking from 'expo-linking';
import { Camera } from 'expo-camera';
import * as Audio from 'expo-av';
// Import the Health Connect services
import { 
  initializeHealthConnect, 
  checkHealthConnectAvailability, 
  SdkAvailabilityStatus 
} from '@/services/healthConnectService';
// Remove background health fetch import since the file was deleted

// Remove health data sync import
// import { registerHealthDataSync, handleHealthSyncNotification } from '@/services/healthDataSyncService';

// Prevent specific warnings from showing in development
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

// Configure notifications for Android - simplified version
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

// Define a background task name for activity recognition
const ACTIVITY_RECOGNITION_TASK = 'ACTIVITY_RECOGNITION_TASK';

// Register the background task for activity recognition
TaskManager.defineTask(ACTIVITY_RECOGNITION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Activity recognition task error:', error);
    return;
  }
  
  if (data) {
    console.log('Activity recognition data:', data);
    // Process activity data here
  }
});

// Permission handler utility
const requestPermissions = async () => {
  try {
    // Request core permissions concurrently (WITHOUT media library)
    const [
      locationPermission, 
      notificationPermission,
      cameraPermission,
      microphonePermission,
    ] = await Promise.all([
      Location.requestForegroundPermissionsAsync(),
      Notifications.requestPermissionsAsync(),
      Camera.requestCameraPermissionsAsync(),
      Audio.Audio.requestPermissionsAsync()
    ]);

    // Request physical activity permission specifically
    let physicalActivityPermission = false;
    
    if (Platform.OS === 'android') {
      try {
        // First check if pedometer is available
        const isPedometerAvailable = await Pedometer.isAvailableAsync();
        
        if (isPedometerAvailable) {
          console.log("Pedometer is available, requesting permission...");
          
          // Use a direct approach to trigger the permission dialog
          // This subscription should trigger the system permission dialog
          const subscription = Pedometer.watchStepCount(() => {
            console.log("Step count updated");
          });
          
          // Small delay to make sure the permission dialog appears
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Test if permission was granted by trying to get steps
          try {
            const now = new Date();
            const start = new Date(now.getTime() - 10000); // 10 seconds ago
            await Pedometer.getStepCountAsync(start, now);
            physicalActivityPermission = true;
            console.log("Physical activity permission granted");
          } catch (stepErr) {
            console.log("Failed to get steps:", stepErr);
            physicalActivityPermission = false;
          }
          
          // Clean up subscription
          subscription.remove();
        } else {
          console.log('Pedometer is not available on this device');
        }
      } catch (err) {
        console.log('Activity recognition permission issue:', err);
        
        // For debugging purposes, let's display the specific error
        console.log('Android version:', Platform.Version);
        console.log('Error details:', JSON.stringify(err));
      }
      
      // If not granted through Pedometer, try a fallback
      if (!physicalActivityPermission) {
        console.log("Trying alternative approach to request physical activity permission");
        
        // Try starting the pedometer again with a different approach
        try {
          // Try to use the pedometer in a different way
          const pedometerIsAvailable = await Pedometer.isAvailableAsync();
          if (pedometerIsAvailable) {
            console.log("Trying alternative pedometer approach...");
            
            // Try to get historical steps which might trigger the permission
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 1); // Go back one day
            
            // This should trigger the permission dialog
            await Pedometer.getStepCountAsync(start, end);
            
            // Double check it worked by trying again
            try {
              const result = await Pedometer.getStepCountAsync(start, end);
              console.log("Got step count:", result.steps);
              physicalActivityPermission = true;
            } catch (stepError) {
              console.log("Still can't access steps:", stepError);
            }
          }
        } catch (taskError) {
          console.log("Error with alternative approach:", taskError);
        }
      }
    } else if (Platform.OS === 'ios') {
      // On iOS, Pedometer will request the permission
      try {
        const isPedometerAvailable = await Pedometer.isAvailableAsync();
        if (isPedometerAvailable) {
          // Just start a subscription which will trigger the permission request on iOS
          const subscription = Pedometer.watchStepCount(() => {});
          subscription.remove();
          physicalActivityPermission = true;
        }
      } catch (err) {
        console.log('iOS pedometer permission issue:', err);
      }
    }

    // Initialize sensors to trigger Android permission dialog if needed
    await Accelerometer.setUpdateInterval(1000);
    await Gyroscope.setUpdateInterval(1000);
    const accelerometerSubscription = Accelerometer.addListener(() => {});
    const gyroscopeSubscription = Gyroscope.addListener(() => {});
    
    // Clean up subscriptions immediately after requesting permissions
    setTimeout(() => {
      accelerometerSubscription.remove();
      gyroscopeSubscription.remove();
    }, 1000);

    // Return comprehensive permission status
    return {
      location: locationPermission.status === 'granted',
      notification: notificationPermission.status === 'granted',
      camera: cameraPermission.status === 'granted',
      microphone: microphonePermission.status === 'granted',
      physicalActivity: physicalActivityPermission,
      sensors: true 
    };
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return {
      location: false,
      notification: false,
      camera: false,
      microphone: false,
      physicalActivity: false,
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
  const [apiUrl, setApiUrl] = useState<string | null>(null);

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
          const { initApiConfig, getApiConfig } = require('@/services/apiConfig');
          await initApiConfig();
          const config = getApiConfig();
          setApiUrl(config.baseUrl);
          
          // Request permissions and show educational alerts if needed
          const permissions = await requestPermissions();
          
          // Initialize Health Connect on Android
          if (Platform.OS === 'android') {
            try {
              console.log('Initializing Health Connect...');
              
              // Check if Health Connect is available
              const status = await checkHealthConnectAvailability();
              if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
                console.log('Health Connect is available');
                
                // Initialize Health Connect
                const initialized = await initializeHealthConnect();
                if (initialized) {
                  console.log('Health Connect initialized successfully');
                  
                  // Remove background health fetch registration
                  // and health data sync registration as requested
                } else {
                  console.log('Failed to initialize Health Connect');
                }
              } else if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
                console.log('Health Connect requires an update');
                // You could show an alert here to prompt the user to update Health Connect
              } else {
                console.log('Health Connect is not available on this device');
              }
            } catch (e) {
              console.log('Error initializing Health Connect:', e);
            }
            
            // Log permissions being used
            try {
              console.log('Checking Android manifest permissions...');
              console.log('Android version:', Platform.Version);
              console.log('App is using these permissions from AndroidManifest.xml:');
              console.log('- ACTIVITY_RECOGNITION (for physical activity)');
              console.log('- CAMERA');
              console.log('- MICROPHONE');
              console.log('- LOCATION');
              console.log('- HEALTH_CONNECT (for steps and distance tracking)');
            } catch (e) {
              console.log('Could not log permissions:', e);
            }
          }
          
          // Check for critical permissions and provide feedback
          if (!permissions.physicalActivity) {
            Alert.alert(
              "Activity Permission Required",
              "MindMate needs access to physical activity data to track your steps and provide wellness insights. Please grant this permission in Settings > Apps > MindMate > Permissions > Physical activity.",
              [{ 
                text: "Open Settings", 
                onPress: () => {
                  // On Android, this will open the app settings
                  // where the user can enable the permission
                  if (Platform.OS === 'android') {
                    Linking.openSettings();
                  }
                } 
              },
              { text: "Later" }]
            );
          }
          
          if (!permissions.camera) {
            Alert.alert(
              "Camera Permission",
              "MindMate needs access to your camera for profile pictures and some features.",
              [{ text: "OK" }]
            );
          }
          
          if (!permissions.microphone) {
            Alert.alert(
              "Microphone Permission",
              "MindMate needs microphone access for voice notes and communication features.",
              [{ text: "OK" }]
            );
          }
          
          setIsReady(true);
          await SplashScreen.hideAsync();
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
      
      // Register background step tracking
      await registerBackgroundStepTracking();
    };
  
    initializeApp();
  }, [loaded]);

  if (!loaded || !isReady) {
    return null;
  }

  return (
    <AuthProvider>
      {__DEV__ && apiUrl && (
        <Text style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          right: 10,
          fontSize: 10,
          color: 'gray',
          zIndex: 9999,
          backgroundColor: 'rgba(255,255,255,0.7)',
          padding: 5,
        }}>
          API URL: {apiUrl}
        </Text>
      )}
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