// app/profile/settings/privacy.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, Switch, ActivityIndicator, Alert, Platform } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as ExpoSensors from 'expo-sensors';
import * as Device from 'expo-device';
import { Camera } from 'expo-camera';
import * as Audio from 'expo-av';
import { Linking } from 'react-native';

interface Permission {
  name: string;
  key: string;
  status: boolean | null;
  description: string;
  icon: string;
  isLoading: boolean;
  requiredForCore: boolean;
}

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([
    {
      name: 'Location',
      key: 'location',
      status: null,
      description: 'Used to track your movement patterns and provide context for wellness insights',
      icon: 'map-marker',
      isLoading: true,
      requiredForCore: true
    },
    {
      name: 'Notifications',
      key: 'notifications',
      status: null,
      description: 'Used for check-in reminders and important wellness alerts',
      icon: 'bell',
      isLoading: true,
      requiredForCore: true
    },
    {
      name: 'Camera',
      key: 'camera',
      status: null, 
      description: 'Used for profile pictures and visual check-in metrics',
      icon: 'camera',
      isLoading: true,
      requiredForCore: false
    },
    {
      name: 'Media Library',
      key: 'mediaLibrary',
      status: null,
      description: 'Access to save photos and media from the app',
      icon: 'photo',
      isLoading: true,
      requiredForCore: false
    },
    {
      name: 'Microphone',
      key: 'microphone',
      status: null,
      description: 'Used for voice notes and audio check-ins',
      icon: 'microphone',
      isLoading: true, 
      requiredForCore: false
    },
    {
      name: 'Motion & Fitness',
      key: 'sensors',
      status: null,
      description: 'Used to track step count and physical activity for wellness metrics',
      icon: 'heartbeat',
      isLoading: true,
      requiredForCore: true
    },
    {
      name: 'Storage',
      key: 'storage',
      status: null,
      description: 'Access to save app data and user preferences',
      icon: 'database',
      isLoading: true,
      requiredForCore: true
    }
  ]);

  // Load permission statuses on screen load and refresh
  const checkPermissions = async () => {
    try {
      console.log('Checking current permission statuses...');
      
      // First set all to loading state
      setPermissions(prev => prev.map(permission => ({
        ...permission,
        isLoading: true
      })));
      
      const locationPermission = await Location.getForegroundPermissionsAsync();
      const notificationPermission = await Notifications.getPermissionsAsync();
      const cameraPermission = await Camera.getCameraPermissionsAsync();
      const mediaLibraryPermission = await MediaLibrary.getPermissionsAsync();
      const microphonePermission = await Audio.Audio.getPermissionsAsync();
      
      // Check sensors permission (using Accelerometer as a proxy)
      const sensorsPermission = await ExpoSensors.Accelerometer.getPermissionsAsync();
      
      // Storage permission is not actually requested on iOS, but on Android it uses the MediaLibrary permission
      const storagePermission = Platform.OS === 'ios' ? { status: 'granted' } : await MediaLibrary.getPermissionsAsync();

      console.log('Permission statuses:');
      console.log('Location:', locationPermission.status);
      console.log('Notifications:', notificationPermission.status);
      console.log('Camera:', cameraPermission.status);
      console.log('Media Library:', mediaLibraryPermission.status);
      console.log('Microphone:', microphonePermission.status);
      console.log('Sensors:', sensorsPermission.status);
      console.log('Storage:', storagePermission.status);

      // Update all permissions statuses
      setPermissions(prev => prev.map(permission => {
        switch (permission.key) {
          case 'location':
            return { ...permission, status: locationPermission.status === 'granted', isLoading: false };
          case 'notifications':
            return { ...permission, status: notificationPermission.status === 'granted', isLoading: false };
          case 'camera':
            return { ...permission, status: cameraPermission.status === 'granted', isLoading: false };
          case 'mediaLibrary':
            return { ...permission, status: mediaLibraryPermission.status === 'granted', isLoading: false };
          case 'microphone':
            return { ...permission, status: microphonePermission.status === 'granted', isLoading: false };
          case 'sensors':
            return { ...permission, status: sensorsPermission.status === 'granted', isLoading: false };
          case 'storage':
            return { ...permission, status: storagePermission.status === 'granted', isLoading: false };
          default:
            return permission;
        }
      }));
    } catch (error) {
      console.error('Error checking permissions:', error);
      // Mark all as not loading anymore even if there was an error
      setPermissions(prev => prev.map(permission => ({
        ...permission,
        isLoading: false
      })));
    }
  };

  // Focus effect to refresh permissions when screen gains focus
  useEffect(() => {
    // Initial check
    checkPermissions();
    
    // Set up listener for screen focus to refresh permissions
    const unsubscribe = () => {}; // Placeholder, would be replaced with actual listener in a real app
    
    // Return cleanup function
    return unsubscribe;
  }, []);

  const handleTogglePermission = async (key: string, currentStatus: boolean) => {
    // Get the current permission name for better user feedback
    const permission = permissions.find(p => p.key === key);
    const permissionName = permission?.name || key;
    
    // For both enabling and disabling permissions, direct the user to settings
    // This is the most reliable approach across different mobile platforms
    Alert.alert(
      `Change ${permissionName} Permission`,
      `To ${currentStatus ? 'disable' : 'enable'} ${permissionName} permission, you'll need to visit your device's settings.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Open Settings",
          onPress: () => {
            // On iOS, linking to app settings
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              // On Android, use the app-specific settings
              Linking.openSettings();
            }
            
            // Remind about important permissions
            if (!currentStatus && permission?.requiredForCore) {
              setTimeout(() => {
                Alert.alert(
                  "Important Permission",
                  `The ${permissionName} permission is required for core functionality of MindMate. Some features may not work properly without it.`,
                  [{ text: "OK" }]
                );
              }, 500);
            }
          }
        }
      ]
    );
  };

  const renderPermissionItem = (permission: Permission) => (
    <Pressable 
      key={permission.key} 
      style={styles.permissionItem}
      onPress={() => {
        if (!permission.isLoading) {
          handleTogglePermission(permission.key, !!permission.status);
        }
      }}
    >
      <View style={styles.permissionContent}>
        <View style={[styles.iconContainer, getIconBackgroundColor(permission.key)]}>
          <FontAwesome name={permission.icon as any} size={20} color="white" />
        </View>
        <View style={styles.permissionText}>
          <Text style={styles.permissionName}>{permission.name}</Text>
          <Text style={styles.permissionDescription}>{permission.description}</Text>
          {permission.requiredForCore && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Required</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.toggleContainer}>
        {permission.isLoading ? (
          <ActivityIndicator size="small" color="#2196F3" />
        ) : (
          <Switch
            value={!!permission.status}
            onValueChange={(value) => handleTogglePermission(permission.key, !!permission.status)}
            trackColor={{ false: '#D1D1D6', true: '#81B0FF' }}
            thumbColor={permission.status ? '#2196F3' : '#f4f3f4'}
            // Ensure the switch is disabled while loading
            disabled={permission.isLoading}
          />
        )}
      </View>
    </Pressable>
  );

  // Helper function to get background color for permission icon
  const getIconBackgroundColor = (key: string) => {
    switch (key) {
      case 'location':
        return { backgroundColor: '#4CAF50' }; // Green
      case 'notifications':
        return { backgroundColor: '#2196F3' }; // Blue
      case 'camera':
        return { backgroundColor: '#FF9800' }; // Orange
      case 'mediaLibrary':
        return { backgroundColor: '#9C27B0' }; // Purple
      case 'microphone':
        return { backgroundColor: '#F44336' }; // Red
      case 'sensors':
        return { backgroundColor: '#FF5722' }; // Deep Orange
      case 'storage':
        return { backgroundColor: '#607D8B' }; // Blue Grey
      default:
        return { backgroundColor: '#757575' }; // Grey
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
        </View>

        {/* Information Banner */}
        <View style={styles.infoBanner}>
          <FontAwesome name="info-circle" size={20} color="#2196F3" style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Manage which information MindMate can access. Disabling required permissions may impact core functionality.
          </Text>
        </View>

        {/* Permission List */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {permissions.map(renderPermissionItem)}
          
          {/* Data Usage Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DATA USAGE & STORAGE</Text>
            
            <Pressable style={styles.menuItem} onPress={() => Alert.alert("Data Storage", "This would take you to a screen explaining how your data is stored.")}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="cloud" size={20} color="#666" style={styles.menuIcon} />
                <View>
                  <Text style={styles.menuTitle}>Data Storage</Text>
                  <Text style={styles.menuSubtitle}>Manage your personal data storage preferences</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            
            <Pressable style={styles.menuItem} onPress={() => Alert.alert("Delete Data", "This would take you to a screen to request data deletion.")}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="trash" size={20} color="#FF3B30" style={styles.menuIcon} />
                <View>
                  <Text style={styles.menuTitle}>Delete My Data</Text>
                  <Text style={styles.menuSubtitle}>Request complete deletion of your account data</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>

          {/* Privacy Policy */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LEGAL</Text>
            
            <Pressable style={styles.menuItem} onPress={() => Alert.alert("Privacy Policy", "This would display the privacy policy.")}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="file-text" size={20} color="#666" style={styles.menuIcon} />
                <View>
                  <Text style={styles.menuTitle}>Privacy Policy</Text>
                  <Text style={styles.menuSubtitle}>Read our privacy policy</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
            
            <Pressable style={styles.menuItem} onPress={() => Alert.alert("Terms of Service", "This would display the terms of service.")}>
              <View style={styles.menuItemContent}>
                <FontAwesome name="gavel" size={20} color="#666" style={styles.menuIcon} />
                <View>
                  <Text style={styles.menuTitle}>Terms of Service</Text>
                  <Text style={styles.menuSubtitle}>Read our terms of service</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 12,
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#0D47A1',
    lineHeight: 20,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  permissionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  permissionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  permissionText: {
    flex: 1,
  },
  permissionName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  permissionDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  requiredBadge: {
    backgroundColor: '#FFE0B2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  requiredText: {
    fontSize: 10,
    color: '#F57C00',
    fontWeight: '600',
  },
  toggleContainer: {
    marginLeft: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  menuTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  chevron: {
    fontSize: 24,
    color: '#666',
    marginTop: -2,
  },
});