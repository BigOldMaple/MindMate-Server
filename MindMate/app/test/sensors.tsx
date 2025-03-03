import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, AppState, AppStateStatus } from 'react-native';
import { stepService } from '@/services/simplifiedStepService';
import * as SecureStore from 'expo-secure-store';

export default function SensorsScreen() {
  const [steps, setSteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('Never');
  const appState = useRef(AppState.currentState);
  const subscriptionRef = useRef<{ remove: () => void } | null>(null);
  
  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
      refreshStepCount();
    }
    appState.current = nextAppState;
  };

  // Refresh step count when needed
  const refreshStepCount = async () => {
    try {
      const todaySteps = await stepService.getTodaySteps();
      setSteps(todaySteps);
      setLastUpdate(new Date().toLocaleTimeString());
      console.log('Step count refreshed:', todaySteps);
    } catch (error) {
      console.error('Error refreshing step count:', error);
    }
  };

  // Set up step counter once on component mount
  useEffect(() => {
    let isMounted = true;
    console.log('Sensor screen mounted');
  
    const setupPedometer = async () => {
      try {
        console.log('Checking pedometer...');
        // Check if pedometer is available
        const available = await stepService.setup();
        if (isMounted) setIsAvailable(available);
        console.log('Pedometer available:', available);
        
        if (available) {
          // Get the latest steps now that setup is complete
          const todaySteps = await stepService.getTodaySteps();
          if (isMounted) {
            console.log('Retrieved latest step count:', todaySteps);
            setSteps(todaySteps);
            setLastUpdate(new Date().toLocaleTimeString());
          }
          
          // Only set up a new subscription if we don't already have one
          if (!subscriptionRef.current) {
            console.log('Setting up step subscription');
            // Subscribe to step count updates
            subscriptionRef.current = stepService.subscribeToUpdates((newSteps) => {
              if (isMounted) {
                console.log('Step update received:', newSteps);
                setSteps(newSteps);
                setLastUpdate(new Date().toLocaleTimeString());
              }
            });
          } else {
            console.log('Using existing step subscription');
          }
        }
      } catch (error) {
        console.error('Error setting up pedometer:', error);
        if (isMounted) setIsAvailable(false);
      }
    };
    
    setupPedometer();
    
    // Set up an interval update as a fallback
    const intervalId = setInterval(() => refreshStepCount(), 30000);
    
    return () => {
      console.log('Sensor screen unmounting - NOT removing step subscription');
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);
      
      // CRITICAL: DON'T remove the subscription or call cleanup
      // This is what was causing the reset
      // if (subscriptionRef.current) {
      //   subscriptionRef.current.remove();
      //   subscriptionRef.current = null;
      // }
      
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Pedometer Sensor</Text>
        <Text style={styles.statusText}>
          Status: {isAvailable === null ? 'Checking...' : isAvailable ? 'Available' : 'Not Available'}
        </Text>
        <Text style={styles.platformText}>Platform: {Platform.OS}</Text>
        <Text style={styles.stepsText}>Today's Steps: {steps}</Text>
        <Text style={styles.updateText}>Last Updated: {lastUpdate}</Text>
        <Text style={styles.noteText}>
          Step count persists across app restarts and only resets at midnight.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 8,
  },
  platformText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
  },
  stepsText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  updateText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#666',
    marginTop: 12,
  }
});