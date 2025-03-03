// utils/sensorPermissions.ts
import { Platform } from 'react-native';
import * as ExpoSensors from 'expo-sensors';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import * as Audio from 'expo-av';
import { Camera } from 'expo-camera';

export class SensorPermissions {
  static async requestRequiredPermissions() {
    try {
      // Request sensor permissions
      const sensors = await ExpoSensors.Accelerometer.requestPermissionsAsync();
      
      // Request location permissions
      const location = await Location.requestForegroundPermissionsAsync();
      
      // Request notification permissions
      const notifications = await Notifications.requestPermissionsAsync();
      
      // Request camera permissions
      const camera = await Camera.requestCameraPermissionsAsync();
      
      // Request media library permissions
      const media = await MediaLibrary.requestPermissionsAsync();
      
      // Request microphone permissions
      const audio = await Audio.Audio.requestPermissionsAsync();
      
      // Note: We're no longer using Health Connect for step tracking
      // Instead, we'll rely on the standard Android activity recognition permission
      // which is already covered by the expo-sensors permission request
      
      // Log permission states in development
      if (__DEV__) {
        console.log('Permission states:', {
          sensors: sensors.status,
          location: location.status,
          notifications: notifications.status,
          camera: camera.status,
          media: media.status,
          audio: audio.status
        });
      }
      
      // Return true if all critical permissions are granted
      // No longer requiring the physicalActivity permission from Health Connect
      return (
        sensors.status === 'granted' &&
        location.status === 'granted' &&
        notifications.status === 'granted'
      );
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }
  
  static async checkSensorPermissions() {
    if (Platform.OS !== 'android') return true;
    try {
      const { status } = await ExpoSensors.Accelerometer.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking sensor permissions:', error);
      return false;
    }
  }
  
  static async checkLocationPermissions() {
    if (Platform.OS !== 'android') return true;
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }
  
  static async ensurePermissions() {
    const hasPermissions = await this.checkSensorPermissions() &&
                          await this.checkLocationPermissions();
    if (!hasPermissions) {
      return await this.requestRequiredPermissions();
    }
    return true;
  }
}