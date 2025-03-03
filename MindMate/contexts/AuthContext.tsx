import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AuthUser } from '../services/auth';
import { notificationService } from '../services/notificationService';
import { Platform, Alert } from 'react-native';

interface AuthContextType {
  user: AuthUser | null;
  signIn: (token: string, userData: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // First, check and request permissions
        const { SensorPermissions } = require('../utils/sensorPermissions');
        const permissionsGranted = await SensorPermissions.requestRequiredPermissions();
        
        if (!permissionsGranted) {
          console.warn('Not all permissions were granted');
          // Show a more detailed explanation to the user about required permissions
          Alert.alert(
            "Important Permissions Required",
            "MindMate needs access to certain device features to function properly. Please grant the requested permissions to get the full experience.",
            [{ text: "OK" }]
          );
        }
        
        // Initialize notification service
        await notificationService.initialize();
        
        // Load auth state
        await loadAuthState();
        
        // Set up notification handlers
        setupNotificationHandlers();
        
        // Check for existing notifications
        await checkForExistingNotifications();
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  // Setup notification handlers
  const setupNotificationHandlers = () => {
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    
    // Set up notification received handler
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received in foreground:', notification);
    });
    
    // Set up notification response handler
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('User tapped on notification:', response);
      
      // Extract route information from the notification data
      const data = response.notification.request.content.data;
      if (data && data.actionRoute) {
        console.log('Navigating to:', data.actionRoute);
        router.push(data.actionRoute as any);
      }
    });
    
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  };

  // Check for any existing check-in notifications
  const checkForExistingNotifications = async () => {
    if (!user) return;
    
    try {
      // Set a flag to check notifications when the user navigates to the notifications screen
      await SecureStore.setItemAsync('shouldRefreshNotifications', 'true');
      
      // Check if we should be in a check-in available state
      const lastCheckInStr = await SecureStore.getItemAsync('lastCheckInTime');
      const nextCheckInTimeStr = await SecureStore.getItemAsync('nextCheckInTime');
      
      if (lastCheckInStr && nextCheckInTimeStr) {
        const now = new Date();
        const nextCheckInTime = new Date(nextCheckInTimeStr);
        
        // If the next check-in time is in the past, we should have a notification
        if (nextCheckInTime < now) {
          console.log('Check-in should be available, creating local notification');
          await notificationService.sendLocalNotification(
            'Check-In Available',
            'Your next check-in is now available. How are you feeling today?',
            { 
              type: 'wellness',
              actionable: true,
              actionRoute: '/home/check_in'
            }
          );
        }
      }
    } catch (error) {
      console.error('Error checking for existing notifications:', error);
    }
  };

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Redirect to home if authenticated
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading]);

  const loadAuthState = async () => {
    try {
      const [token, userDataString] = await Promise.all([
        SecureStore.getItemAsync('userToken'),
        SecureStore.getItemAsync('userData')
      ]);

      if (token && userDataString) {
        const userData = JSON.parse(userDataString);
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (token: string, userData: AuthUser) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync('userToken', token),
        SecureStore.setItemAsync('userData', JSON.stringify(userData))
      ]);
      setUser(userData);
      
      // After sign-in, re-initialize notification service to ensure token is registered
      await notificationService.initialize();
      await notificationService.registerForPushNotifications();
    } catch (error) {
      console.error('Error storing auth state:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('userToken'),
        SecureStore.deleteItemAsync('userData')
      ]);
      setUser(null);
    } catch (error) {
      console.error('Error clearing auth state:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};