// app/profile/settings/health-connect-test.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  initializeHealthConnect,
  checkHealthConnectAvailability,
  requestHealthConnectPermissions,
  getHealthConnectPermissions,
  getAggregatedSteps,
  getAggregatedDistance,
  openHealthSettings,
  SdkAvailabilityStatus,
} from '@/services/healthConnectService';

export default function HealthConnectTestScreen() {
  const router = useRouter();
  const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState<boolean>(false);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [stepsData, setStepsData] = useState<any>(null);
  const [distanceData, setDistanceData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealthConnect = async () => {
      try {
        setIsLoading(true);
        
        // Only continue if on Android
        if (Platform.OS !== 'android') {
          setError('Health Connect is only available on Android devices');
          setIsLoading(false);
          return;
        }
        
        // Check if Health Connect is available
        const status = await checkHealthConnectAvailability();
        const available = status === SdkAvailabilityStatus.SDK_AVAILABLE;
        setIsHealthConnectAvailable(available);
        
        if (!available) {
          if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
            setError('Health Connect is available but requires an update');
          } else {
            setError('Health Connect is not available on this device');
          }
          setIsLoading(false);
          return;
        }
        
        // Initialize Health Connect
        const initialized = await initializeHealthConnect();
        if (!initialized) {
          setError('Failed to initialize Health Connect');
          setIsLoading(false);
          return;
        }
        
        // Check if we have permissions
        const permissions = await getHealthConnectPermissions();
        const hasStepsPermission = permissions.some(
          (p) => p.recordType === 'Steps' && p.accessType === 'read'
        );
        setHasPermissions(hasStepsPermission);
        
        if (hasStepsPermission) {
          await fetchHealthData();
        }
      } catch (err) {
        console.error('Error in Health Connect initialization:', err);
        setError('An error occurred while setting up Health Connect');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkHealthConnect();
  }, []);

  const fetchHealthData = async () => {
    try {
      setIsLoadingData(true);
      // Fetch data for the last 7 days
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const steps = await getAggregatedSteps(startTime, endTime);
      setStepsData(steps);
      
      const distance = await getAggregatedDistance(startTime, endTime);
      setDistanceData(distance);
    } catch (err) {
      console.error('Error fetching health data:', err);
      setError('Failed to fetch health data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRequestPermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await requestHealthConnectPermissions();
      const hasStepsPermission = permissions.some(
        (p) => p.recordType === 'Steps' && p.accessType === 'read'
      );
      setHasPermissions(hasStepsPermission);
      
      if (hasStepsPermission) {
        await fetchHealthData();
      }
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError('Failed to request permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = () => {
    openHealthSettings();
  };

  // Format distance to 2 decimal places and add unit
  const formatDistance = (distanceData: any) => {
    if (!distanceData) return '0 m';
    
    // The actual distance is nested inside the DISTANCE property
    const distance = distanceData.DISTANCE;
    if (!distance || !distance.inMeters) return '0 m';
    
    if (distance.inMeters >= 1000) {
      return `${(distance.inMeters / 1000).toFixed(2)} km`;
    } else {
      return `${Math.round(distance.inMeters)} m`;
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
          <Text style={styles.headerTitle}>Health Connect Test</Text>
        </View>

        <ScrollView style={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066cc" />
              <Text style={styles.loadingText}>Checking Health Connect status...</Text>
            </View>
          ) : (
            <>
              {/* Status Section */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Health Connect Status</Text>
                
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Available:</Text>
                  <Text style={[
                    styles.statusValue, 
                    { color: isHealthConnectAvailable ? '#00c853' : '#f44336' }
                  ]}>
                    {isHealthConnectAvailable ? 'Yes' : 'No'}
                  </Text>
                </View>
                
                {isHealthConnectAvailable && (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Permissions:</Text>
                    <Text style={[
                      styles.statusValue, 
                      { color: hasPermissions ? '#00c853' : '#f44336' }
                    ]}>
                      {hasPermissions ? 'Granted' : 'Not Granted'}
                    </Text>
                  </View>
                )}
                
                {error && (
                  <View style={styles.errorContainer}>
                    <FontAwesome name="exclamation-triangle" size={16} color="#f44336" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                
                <View style={styles.buttonRow}>
                  {!isHealthConnectAvailable && (
                    <Pressable
                      style={styles.button}
                      onPress={handleOpenSettings}
                    >
                      <Text style={styles.buttonText}>Install Health Connect</Text>
                    </Pressable>
                  )}
                  
                  {isHealthConnectAvailable && !hasPermissions && (
                    <Pressable
                      style={styles.button}
                      onPress={handleRequestPermissions}
                    >
                      <Text style={styles.buttonText}>Request Permissions</Text>
                    </Pressable>
                  )}
                  
                  {isHealthConnectAvailable && hasPermissions && (
                    <Pressable
                      style={styles.button}
                      onPress={fetchHealthData}
                      disabled={isLoadingData}
                    >
                      {isLoadingData ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.buttonText}>Refresh Data</Text>
                      )}
                    </Pressable>
                  )}
                  
                  {isHealthConnectAvailable && (
                    <Pressable
                      style={[styles.button, styles.secondaryButton]}
                      onPress={handleOpenSettings}
                    >
                      <Text style={styles.secondaryButtonText}>Open Settings</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Health Data Section */}
              {hasPermissions && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Health Data (Last 7 Days)</Text>
                  
                  {isLoadingData ? (
                    <View style={styles.centerContainer}>
                      <ActivityIndicator size="small" color="#0066cc" />
                      <Text style={styles.loadingText}>Loading data...</Text>
                    </View>
                  ) : (
                    <>
                      {/* Steps Data */}
                      <View style={styles.dataContainer}>
                        <Text style={styles.dataLabel}>Total Steps:</Text>
                        <Text style={styles.dataValue}>
                          {stepsData?.COUNT_TOTAL || 0}
                        </Text>
                      </View>
                      
                      {/* Distance Data */}
                      <View style={styles.dataContainer}>
                        <Text style={styles.dataLabel}>Total Distance:</Text>
                        <Text style={styles.dataValue}>
                          {distanceData ? formatDistance(distanceData) : '0 m'}
                        </Text>
                      </View>
                      
                      <Text style={styles.dataSourceText}>
                        Data Sources: {stepsData?.dataOrigins?.join(', ') || 'None'}
                      </Text>
                      
                      {(!stepsData?.COUNT_TOTAL && !distanceData?.inMeters) && (
                        <Text style={styles.noDataText}>
                          No health data available for the last 7 days. Try recording some activity with a fitness app that integrates with Health Connect.
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Information Section */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>About Health Connect</Text>
                <Text style={styles.infoText}>
                  Health Connect allows fitness apps to share health and fitness data with each other.
                  This enables MindMate to retrieve step and distance data from Health Connect, even when collected by other fitness apps.
                </Text>
                <Text style={styles.infoText}>
                  For this to work, you need:
                </Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• An Android device (Android 9 or higher)</Text>
                  <Text style={styles.bulletPoint}>• Health Connect app installed</Text>
                  <Text style={styles.bulletPoint}>• At least one fitness app that shares data with Health Connect</Text>
                </View>
                <Text style={styles.infoText}>
                  This feature allows MindMate to track your physical activity even when the app is closed.
                </Text>
              </View>
            </>
          )}
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
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
  },
  centerContainer: {
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    color: '#f44336',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginHorizontal: 4,
    marginBottom: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
  },
  dataContainer: {
    marginBottom: 16,
  },
  dataLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  dataValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 8,
  },
  dataSourceText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
});