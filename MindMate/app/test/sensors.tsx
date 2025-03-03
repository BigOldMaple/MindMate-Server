import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Platform } from 'react-native';
import { stepService } from '@/services/simplifiedStepService';

export default function SensorsScreen() {
  const [steps, setSteps] = useState(0);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('Never');

  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;
    
    const setupPedometer = async () => {
      try {
        // Check if pedometer is available
        const available = await stepService.setup();
        if (isMounted) setIsAvailable(available);
        
        if (available) {
          // Get initial step count
          try {
            const todaySteps = await stepService.getTodaySteps();
            if (isMounted) {
              setSteps(todaySteps);
              setLastUpdate(new Date().toLocaleTimeString());
            }
          } catch (error) {
            console.error('Error getting initial steps:', error);
          }
          
          // Subscribe to step count updates
          subscription = stepService.subscribeToUpdates((newSteps) => {
            if (isMounted) {
              setSteps(newSteps);
              setLastUpdate(new Date().toLocaleTimeString());
            }
          });
        }
      } catch (error) {
        console.error('Error setting up pedometer:', error);
        if (isMounted) setIsAvailable(false);
      }
    };
    
    setupPedometer();
    
    // Set up an interval update as a fallback
    const intervalId = setInterval(async () => {
      if (isAvailable) {
        try {
          const todaySteps = await stepService.getTodaySteps();
          if (isMounted) {
            setSteps(todaySteps);
            setLastUpdate(new Date().toLocaleTimeString());
          }
        } catch (error) {
          console.error('Error fetching steps in interval:', error);
        }
      }
    }, 30000); // Update every 30 seconds
    
    return () => {
      isMounted = false;
      if (subscription) subscription.remove();
      clearInterval(intervalId);
      stepService.cleanup(); // Clean up any subscriptions
    };
  }, []);
  
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
  },
});