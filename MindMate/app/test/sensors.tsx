import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert, ScrollView, Button } from 'react-native';
import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';
import { useIsFocused } from '@react-navigation/native';

type SensorData = {
  x: number;
  y: number;
  z: number;
};

export default function SensorTest() {
  const [accelerometerData, setAccelerometerData] = useState<SensorData>({ 
    x: 0, 
    y: 0, 
    z: 0 
  });
  const [gyroscopeData, setGyroscopeData] = useState<SensorData>({ 
    x: 0, 
    y: 0, 
    z: 0 
  });
  const [accelerometerAvailable, setAccelerometerAvailable] = useState<boolean>(true);
  const [gyroscopeAvailable, setGyroscopeAvailable] = useState<boolean>(true);
  const [isPedometerAvailable, setIsPedometerAvailable] = useState<boolean>(false);
  const [currentStepCount, setCurrentStepCount] = useState<number>(0);
  const [pastStepCount, setPastStepCount] = useState<number>(0);
  const [isTrackingSteps, setIsTrackingSteps] = useState<boolean>(false);
  
  const isFocused = useIsFocused();
  const pedometerSubscription = useRef<{ remove: () => void } | null>(null);
  const pastStepCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    const setupSensors = async () => {
      try {
        // Check accelerometer availability
        const accelerometerIsAvailable = await Accelerometer.isAvailableAsync();
        setAccelerometerAvailable(accelerometerIsAvailable);

        // Check gyroscope availability
        const gyroscopeIsAvailable = await Gyroscope.isAvailableAsync();
        setGyroscopeAvailable(gyroscopeIsAvailable);
        
        // Check pedometer availability
        const pedometerIsAvailable = await Pedometer.isAvailableAsync();
        setIsPedometerAvailable(pedometerIsAvailable);

        if (isFocused) {
          if (accelerometerIsAvailable) {
            // Configure update interval (in milliseconds)
            Accelerometer.setUpdateInterval(100);

            // Start accelerometer subscription
            accelerometerSubscription = Accelerometer.addListener(data => {
              setAccelerometerData(data);
            });
          }

          if (gyroscopeIsAvailable) {
            // Configure update interval (in milliseconds)
            Gyroscope.setUpdateInterval(100);

            // Start gyroscope subscription
            gyroscopeSubscription = Gyroscope.addListener(data => {
              setGyroscopeData(data);
            });
          }
          
          if (pedometerIsAvailable) {
            // Start tracking steps if available
            startStepTracking();
          }
        }
      } catch (error) {
        Alert.alert(
          'Sensor Error',
          'Failed to initialize sensors. Please ensure you have granted the necessary permissions.'
        );
        console.error('Sensor setup error:', error);
      }
    };

    setupSensors();

    // Cleanup subscriptions when component unmounts or loses focus
    return () => {
      if (accelerometerSubscription) {
        accelerometerSubscription.remove();
      }
      if (gyroscopeSubscription) {
        gyroscopeSubscription.remove();
      }
      stopStepTracking();
    };
  }, [isFocused]);

  const startStepTracking = async () => {
    try {
      // Start listening for step count updates
      pedometerSubscription.current = Pedometer.watchStepCount(result => {
        setCurrentStepCount(result.steps);
      });
      
      // Set up periodic check for past 10 minutes steps
      updatePastStepCount();
      
      // Check past steps every minute
      pastStepCheckInterval.current = setInterval(() => {
        updatePastStepCount();
      }, 60000); // Check every minute
      
      setIsTrackingSteps(true);
    } catch (error) {
      console.error('Failed to start step tracking:', error);
      Alert.alert('Step Tracking Error', 'Failed to start step tracking');
    }
  };
  
  const stopStepTracking = () => {
    // Clean up pedometer subscription
    if (pedometerSubscription.current) {
      pedometerSubscription.current.remove();
      pedometerSubscription.current = null;
    }
    
    // Clear interval
    if (pastStepCheckInterval.current) {
      clearInterval(pastStepCheckInterval.current);
      pastStepCheckInterval.current = null;
    }
    
    setIsTrackingSteps(false);
  };
  
  const updatePastStepCount = async () => {
    try {
      // Calculate time range for past 10 minutes
      const end = new Date();
      const start = new Date(end.getTime() - 10 * 60 * 1000); // 10 minutes ago
      
      // Request step count for the past 10 minutes
      const pastSteps = await Pedometer.getStepCountAsync(start, end);
      
      console.log(`Steps in past 10 minutes: ${pastSteps.steps}`);
      setPastStepCount(pastSteps.steps);
    } catch (error) {
      console.error('Error getting past step count:', error);
    }
  };

  const round = (n: number) => Math.round(n * 100) / 100;

  if (!accelerometerAvailable && !gyroscopeAvailable && !isPedometerAvailable) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Sensors Unavailable</Text>
        <Text style={styles.errorText}>
          Your device does not support the required sensors.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sensor Test</Text>
      
      {accelerometerAvailable && (
        <View style={styles.sensorContainer}>
          <Text style={styles.sensorTitle}>Accelerometer:</Text>
          <Text style={styles.sensorText}>
            x: {round(accelerometerData.x)} {'\n'}
            y: {round(accelerometerData.y)} {'\n'}
            z: {round(accelerometerData.z)}
          </Text>
        </View>
      )}

      {gyroscopeAvailable && (
        <View style={styles.sensorContainer}>
          <Text style={styles.sensorTitle}>Gyroscope:</Text>
          <Text style={styles.sensorText}>
            x: {round(gyroscopeData.x)} {'\n'}
            y: {round(gyroscopeData.y)} {'\n'}
            z: {round(gyroscopeData.z)}
          </Text>
        </View>
      )}
      
      {isPedometerAvailable && (
        <View style={styles.sensorContainer}>
          <Text style={styles.sensorTitle}>Pedometer:</Text>
          {isTrackingSteps ? (
            <>
              <Text style={styles.sensorText}>
                Current Session Steps: {currentStepCount}{'\n'}
                Steps in past 10 minutes: {pastStepCount}
              </Text>
              <View style={styles.buttonContainer}>
                <Button 
                  title="Refresh 10-min History" 
                  onPress={updatePastStepCount}
                  color="#2196F3" 
                />
                <Button 
                  title="Stop Tracking" 
                  onPress={stopStepTracking}
                  color="#FF3B30" 
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sensorText}>
                Step tracking is currently disabled.
              </Text>
              <Button 
                title="Start Step Tracking" 
                onPress={startStepTracking}
                color="#4CAF50" 
              />
            </>
          )}
        </View>
      )}
      
      {!isPedometerAvailable && (
        <View style={styles.sensorContainer}>
          <Text style={styles.sensorTitle}>Pedometer:</Text>
          <Text style={styles.errorText}>
            Pedometer is not available on this device or permission is denied.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  sensorContainer: {
    backgroundColor: '#f5f6fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sensorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  sensorText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});