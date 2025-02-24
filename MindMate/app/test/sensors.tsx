import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { Accelerometer, Gyroscope } from 'expo-sensors';
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
  const isFocused = useIsFocused();

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

    // Cleanup subscriptions
    return () => {
      if (accelerometerSubscription) {
        accelerometerSubscription.remove();
      }
      if (gyroscopeSubscription) {
        gyroscopeSubscription.remove();
      }
    };
  }, [isFocused]);

  const round = (n: number) => Math.round(n * 100) / 100;

  if (!accelerometerAvailable && !gyroscopeAvailable) {
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
    <View style={styles.container}>
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
    </View>
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
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
});