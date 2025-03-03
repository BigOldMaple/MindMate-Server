import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert, ScrollView, Button, Linking } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
import { useIsFocused } from '@react-navigation/native';
import { healthConnectService } from '@/services/healthConnectService';

type SensorData = {
  x: number;
  y: number;
  z: number;
};

export default function SensorTest() {
  const [accelerometerData, setAccelerometerData] = useState<SensorData>({ 
    x: 0, y: 0, z: 0 
  });
  const [gyroscopeData, setGyroscopeData] = useState<SensorData>({ 
    x: 0, y: 0, z: 0 
  });
  const [accelerometerAvailable, setAccelerometerAvailable] = useState<boolean>(true);
  const [gyroscopeAvailable, setGyroscopeAvailable] = useState<boolean>(true);
  const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState<boolean>(false);
  const [dailyStepCount, setDailyStepCount] = useState<number>(0);
  const [isLoadingSteps, setIsLoadingSteps] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const isFocused = useIsFocused();
  const stepUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    let accelerometerSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let gyroscopeSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

    const setupSensors = async () => {
      try {
        // Check accelerometer and gyroscope availability
        const accelerometerIsAvailable = await Accelerometer.isAvailableAsync();
        setAccelerometerAvailable(accelerometerIsAvailable);

        const gyroscopeIsAvailable = await Gyroscope.isAvailableAsync();
        setGyroscopeAvailable(gyroscopeIsAvailable);
        
        // Initialize Health Connect
        const healthConnectAvailable = await healthConnectService.initialize();
        setIsHealthConnectAvailable(healthConnectAvailable);

        if (isFocused) {
          if (accelerometerIsAvailable) {
            Accelerometer.setUpdateInterval(100);
            accelerometerSubscription = Accelerometer.addListener(data => {
              setAccelerometerData(data);
            });
          }

          if (gyroscopeIsAvailable) {
            Gyroscope.setUpdateInterval(100);
            gyroscopeSubscription = Gyroscope.addListener(data => {
              setGyroscopeData(data);
            });
          }
          
          if (healthConnectAvailable) {
            // Immediately fetch step data
            await fetchStepData();
            
            // Set up interval to update step data every 30 seconds
            stepUpdateInterval.current = setInterval(fetchStepData, 30000);
          }
        }
      } catch (error) {
        console.error('Sensor setup error:', error);
        if (isMounted) {
          Alert.alert('Sensor Error', 'Failed to initialize sensors.');
        }
      }
    };
  
    if (isFocused) {
      setupSensors();
    }
  
    return () => {
      isMounted = false;
      if (accelerometerSubscription) {
        accelerometerSubscription.remove();
      }
      if (gyroscopeSubscription) {
        gyroscopeSubscription.remove();
      }
      if (stepUpdateInterval.current) {
        clearInterval(stepUpdateInterval.current);
      }
    };
  }, [isFocused]);

  const fetchStepData = async () => {
    if (!isHealthConnectAvailable) {
      console.log('Skipping step data fetch: Health Connect not available');
      return;
    }
  
    let isMounted = true; // Track if component is still mounted
  
    try {
      setIsLoadingSteps(true);
      
      // First check and request permissions if needed
      try {
        const hasPermission = await healthConnectService.requestStepCountPermission();
        if (!hasPermission) {
          console.log('Step count permission denied');
          if (isMounted) {
            setDailyStepCount(0);
            setLastUpdated(new Date());
          }
          return;
        }
      } catch (permissionError) {
        console.error('Error requesting permissions:', permissionError);
        // Continue anyway to handle the error gracefully
      }
      
      // Now try to get the step count
      try {
        const steps = await healthConnectService.getTodayStepCount();
        if (isMounted) {
          setDailyStepCount(steps);
          setLastUpdated(new Date());
        }
      } catch (stepError) {
        console.error('Error fetching step data:', stepError);
        if (isMounted) {
          Alert.alert('Error', 'Failed to fetch step data. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error in fetchStepData:', error);
      if (isMounted) {
        Alert.alert('Error', 'Failed to fetch step data. Please try again.');
      }
    } finally {
      if (isMounted) {
        setIsLoadingSteps(false);
      }
    }
  
    // Cleanup to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  };
  const handleInstallHealthConnect = async () => {
    try {
      await healthConnectService.openHealthConnectSettings();
      
      // Check availability again after potential installation
      setTimeout(async () => {
        const available = await healthConnectService.initialize();
        console.log('Health Connect availability after install attempt:', available);
        setIsHealthConnectAvailable(available);
        if (available) {
          await fetchStepData();
        } else {
          Alert.alert('Error', 'Health Connect is still not available. Please ensure it is installed and configured.');
        }
      }, 2000); // Increased delay to give user time to install
    } catch (error) {
      console.error('Error opening Health Connect settings:', error);
      Linking.openURL('market://details?id=com.google.android.apps.healthdata');
    }
  };

  const round = (n: number) => Math.round(n * 100) / 100;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sensor Test</Text>
      
      {/* Accelerometer and Gyroscope sections */}
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
      
      {/* Health Connect Section */}
      <View style={styles.sensorContainer}>
        <Text style={styles.sensorTitle}>Health Connect Steps:</Text>
        {isHealthConnectAvailable ? (
          <>
            <Text style={styles.sensorText}>
              Today's Steps: {dailyStepCount}
              {lastUpdated && `\nLast Updated: ${lastUpdated.toLocaleTimeString()}`}
            </Text>
            <Button 
              title={isLoadingSteps ? "Updating..." : "Refresh Step Count"} 
              onPress={fetchStepData}
              disabled={isLoadingSteps}
              color="#2196F3"
            />
          </>
        ) : (
          <>
            <Text style={styles.errorText}>
              Health Connect is not available on this device. You may need to install the Health Connect app from the Google Play Store.
            </Text>
            <Button 
              title="Install Health Connect" 
              onPress={handleInstallHealthConnect}
              color="#4CAF50"
            />
          </>
        )}
      </View>
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