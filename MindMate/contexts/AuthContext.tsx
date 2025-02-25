import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AuthUser } from '../services/auth';
import { notificationService } from '../services/notificationService';

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
      await loadAuthState();
      
      // Initialize notification service when the app starts
      try {
        console.log('Initializing notification service from AuthContext');
        await notificationService.initialize();
        
        // Set up notification handlers
        const subscription = Notifications.addNotificationReceivedListener(notification => {
          console.log('Notification received in foreground:', notification);
        });
        
        const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
          console.log('User tapped on notification:', response);
          // Handle notification tap here
        });
        
        return () => {
          subscription.remove();
          responseSubscription.remove();
        };
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
      }
    };
    
    initializeApp();
  }, []);

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