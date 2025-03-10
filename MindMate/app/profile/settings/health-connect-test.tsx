// app/profile/settings/health-connect-test.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { healthConnectService } from '@/services/HealthConnectService';

export default function HealthConnectTestScreen() {
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [weeklySteps, setWeeklySteps] = useState<{date: string, steps: number}[]>([]);
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({
    initialize: false,
    permission: false,
    todaySteps: false,
    weeklySteps: false,
  });
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    const available = healthConnectService.isAvailable();
    setIsAvailable(available);
    
    if (available) {
      setIsLoading(prev => ({ ...prev, initialize: true }));
      const initialized = await healthConnectService.initialize();
      setIsInitialized(initialized);
      setIsLoading(prev => ({ ...prev, initialize: false }));
      
      // Check for existing permissions
      if (initialized) {
        checkPermission();
        loadLastSync();
      }
    }
  };

  const checkPermission = async () => {
    setIsLoading(prev => ({ ...prev, permission: true }));
    try {
      // For simplicity, we'll just request permissions here
      // In a production app, you might want to check permissions first without requesting
      const granted = await healthConnectService.requestStepPermissions();
      setHasPermission(granted);
      
      if (granted) {
        // Load data if permission granted
        loadTodaySteps();
        loadWeeklySteps();
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, permission: false }));
    }
  };

  const loadLastSync = async () => {
    const time = await healthConnectService.getLastSyncTime();
    setLastSync(time);
  };

  const loadTodaySteps = async () => {
    setIsLoading(prev => ({ ...prev, todaySteps: true }));
    try {
      const steps = await healthConnectService.getTodaySteps();
      setTodaySteps(steps);
      
      // Store the step count for persistence
      await healthConnectService.storeStepCount(steps);
      await loadLastSync();
    } catch (error) {
      console.error('Error loading today steps:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, todaySteps: false }));
    }
  };

  const loadWeeklySteps = async () => {
    setIsLoading(prev => ({ ...prev, weeklySteps: true }));
    try {
      const steps = await healthConnectService.getWeeklySteps();
      setWeeklySteps(steps);
    } catch (error) {
      console.error('Error loading weekly steps:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, weeklySteps: false }));
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
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
          {/* Availability Status */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>System Status</Text>
            
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Health Connect Available:</Text>
              {isAvailable === null ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <Text style={[
                  styles.statusValue,
                  isAvailable ? styles.statusSuccess : styles.statusError
                ]}>
                  {isAvailable ? 'Yes' : 'No'}
                </Text>
              )}
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Health Connect Initialized:</Text>
              {isLoading.initialize ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <Text style={[
                  styles.statusValue,
                  isInitialized ? styles.statusSuccess : styles.statusError
                ]}>
                  {isInitialized ? 'Yes' : 'No'}
                </Text>
              )}
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Step Permissions:</Text>
              {isLoading.permission ? (
                <ActivityIndicator size="small" color="#2196F3" />
              ) : (
                <Text style={[
                  styles.statusValue,
                  hasPermission ? styles.statusSuccess : styles.statusError
                ]}>
                  {hasPermission ? 'Granted' : 'Not Granted'}
                </Text>
              )}
            </View>

            {!isAvailable && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Health Connect is only available on Android devices with the Health Connect app installed.
                </Text>
              </View>
            )}

            {isAvailable && !isInitialized && (
              <Pressable
                style={styles.actionButton}
                onPress={checkAvailability}
              >
                <Text style={styles.actionButtonText}>Initialize Health Connect</Text>
              </Pressable>
            )}

            {isInitialized && !hasPermission && (
              <Pressable
                style={styles.actionButton}
                onPress={checkPermission}
              >
                <Text style={styles.actionButtonText}>Request Permissions</Text>
              </Pressable>
            )}
          </View>

          {/* Today's Steps */}
          {hasPermission && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today's Steps</Text>
              
              {isLoading.todaySteps ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : (
                <View style={styles.stepsContainer}>
                  <Text style={styles.stepsCount}>{todaySteps !== null ? todaySteps.toLocaleString() : '-'}</Text>
                  <Text style={styles.stepsLabel}>steps</Text>
                  
                  {lastSync && (
                    <Text style={styles.syncTime}>
                      Last synced: {lastSync.toLocaleTimeString()}
                    </Text>
                  )}
                  
                  <Pressable
                    style={styles.refreshButton}
                    onPress={loadTodaySteps}
                  >
                    <FontAwesome name="refresh" size={16} color="#2196F3" />
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Weekly Steps */}
          {hasPermission && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Steps</Text>
              
              {isLoading.weeklySteps ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : (
                <>
                  <View style={styles.weeklyContainer}>
                    {weeklySteps.map((day) => (
                      <View key={day.date} style={styles.weeklyBar}>
                        <View 
                          style={[
                            styles.weeklyBarFill, 
                            { 
                              height: `${Math.min(100, (day.steps / 10000) * 100)}%`,
                              backgroundColor: day.date === new Date().toISOString().split('T')[0] 
                                ? '#2196F3' 
                                : '#90CAF9'
                            }
                          ]} 
                        />
                        <Text style={styles.weeklyBarLabel}>{formatDate(day.date)}</Text>
                        <Text style={styles.weeklyBarValue}>{day.steps}</Text>
                      </View>
                    ))}
                  </View>
                  
                  <Pressable
                    style={styles.refreshButton}
                    onPress={loadWeeklySteps}
                  >
                    <FontAwesome name="refresh" size={16} color="#2196F3" />
                    <Text style={styles.refreshButtonText}>Refresh</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Information Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About Health Connect</Text>
            <Text style={styles.infoText}>
              Health Connect allows fitness apps to share health and fitness data with each other.
              This screen demonstrates how MindMate can retrieve step data from Health Connect.
            </Text>
            <Text style={styles.infoText}>
              For this to work, you need to have:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>• An Android device</Text>
              <Text style={styles.bulletPoint}>• Health Connect app installed</Text>
              <Text style={styles.bulletPoint}>• At least one fitness app that records steps and shares them with Health Connect</Text>
            </View>
            <Text style={styles.infoText}>
              This feature allows MindMate to track your steps even when the app is closed.
            </Text>
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
  content: {
    flex: 1,
    padding: 16,
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
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusSuccess: {
    color: '#4CAF50',
  },
  statusError: {
    color: '#F44336',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  stepsContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  stepsCount: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  stepsLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  syncTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: '#2196F3',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  weeklyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    marginBottom: 24,
  },
  weeklyBar: {
    flex: 1,
    height: 150,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  weeklyBarFill: {
    width: 20,
    borderRadius: 10,
    backgroundColor: '#90CAF9',
    minHeight: 4,
  },
  weeklyBarLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  weeklyBarValue: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
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