import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { AuthUser } from '../services/auth';

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
    loadAuthState();
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