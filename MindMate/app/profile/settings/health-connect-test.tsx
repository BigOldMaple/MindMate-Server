// app/profile/settings/health-connect-test.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  initializeHealthConnect,
  checkHealthConnectAvailability,
  requestHealthConnectPermissions,
  requestSleepPermissions,
  requestExercisePermissions,
  requestAllHealthPermissions,
  getHealthConnectPermissions,
  getAggregatedSteps,
  getAggregatedDistance,
  openHealthSettings,
  readSleepSessions,
  getTotalSleepTime,
  formatSleepDuration,
  getSleepQualityDescription,
  formatDistance,
  readExerciseSessions,
  getTotalExerciseStats,
  formatExerciseDuration,
  getExerciseTypeName,
  ExerciseType,
  SdkAvailabilityStatus,
} from '@/services/healthConnectService';

export default function HealthConnectTestScreen() {
  const router = useRouter();
  const [isHealthConnectAvailable, setIsHealthConnectAvailable] = useState<boolean>(false);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [hasSleepPermissions, setHasSleepPermissions] = useState<boolean>(false);
  const [hasExercisePermissions, setHasExercisePermissions] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [stepsData, setStepsData] = useState<any>(null);
  const [distanceData, setDistanceData] = useState<any>(null);
  const [sleepData, setSleepData] = useState<any>(null);
  const [lastNightSleep, setLastNightSleep] = useState<any>(null);
  const [exerciseData, setExerciseData] = useState<any>(null);
  const [exerciseSessions, setExerciseSessions] = useState<any[]>([]);
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

        const hasSleepPermission = permissions.some(
          (p) => p.recordType === 'SleepSession' && p.accessType === 'read'
        );

        const hasExercisePermission = permissions.some(
          (p) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
        );

        setHasPermissions(hasStepsPermission);
        setHasSleepPermissions(hasSleepPermission);
        setHasExercisePermissions(hasExercisePermission);

        if (hasStepsPermission) {
          await fetchHealthData();
        }

        if (hasSleepPermission) {
          await fetchSleepData();
        }

        if (hasExercisePermission) {
          await fetchExerciseData();
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

  const fetchSleepData = async () => {
    try {
      setIsLoadingData(true);

      // Fetch data for the last 7 days
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get total sleep time
      const totalSleep = await getTotalSleepTime(startTime, endTime);
      setSleepData(totalSleep);

      // Get individual sleep sessions
      const sleepSessions = await readSleepSessions(startTime, endTime);
      console.log('Sleep sessions:', sleepSessions.length);

      // Find the most recent sleep session (last night)
      if (sleepSessions.length > 0) {
        // Sort by start time, most recent first
        const sortedSessions = [...sleepSessions].sort((a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        setLastNightSleep(sortedSessions[0]);
      }
    } catch (err) {
      console.error('Error fetching sleep data:', err);
      setError('Failed to fetch sleep data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchExerciseData = async () => {
    try {
      setIsLoadingData(true);

      // Fetch data for the last 7 days
      const endTime = new Date().toISOString();
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get exercise stats
      const exerciseStats = await getTotalExerciseStats(startTime, endTime);
      setExerciseData(exerciseStats);

      // Get individual exercise sessions
      const sessions = await readExerciseSessions(startTime, endTime);

      // Add this debug log
      console.log('Exercise session details:', JSON.stringify(sessions.map(s => ({
        type: s.exerciseType,
        typeName: getExerciseTypeName(s.exerciseType),
        start: s.startTime,
        duration: new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
      })), null, 2));

      // Sort by start time, most recent first
      const sortedSessions = [...sessions].sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      setExerciseSessions(sortedSessions);

      console.log('Exercise sessions:', sessions.length);
    } catch (err) {
      console.error('Error fetching exercise data:', err);
      setError('Failed to fetch exercise data');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRequestAllPermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await requestAllHealthPermissions();

      const hasStepsPermission = permissions.some(
        (p) => p.recordType === 'Steps' && p.accessType === 'read'
      );

      const hasSleepPermission = permissions.some(
        (p) => p.recordType === 'SleepSession' && p.accessType === 'read'
      );

      const hasExercisePermission = permissions.some(
        (p) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
      );

      setHasPermissions(hasStepsPermission);
      setHasSleepPermissions(hasSleepPermission);
      setHasExercisePermissions(hasExercisePermission);

      if (hasStepsPermission) {
        await fetchHealthData();
      }

      if (hasSleepPermission) {
        await fetchSleepData();
      }

      if (hasExercisePermission) {
        await fetchExerciseData();
      }
    } catch (err) {
      console.error('Error requesting permissions:', err);
      setError('Failed to request permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestActivityPermissions = async () => {
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
      console.error('Error requesting activity permissions:', err);
      setError('Failed to request activity permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSleepPermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await requestSleepPermissions();
      const hasSleepPermission = permissions.some(
        (p) => p.recordType === 'SleepSession' && p.accessType === 'read'
      );
      setHasSleepPermissions(hasSleepPermission);

      if (hasSleepPermission) {
        await fetchSleepData();
      }
    } catch (err) {
      console.error('Error requesting sleep permissions:', err);
      setError('Failed to request sleep permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestExercisePermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await requestExercisePermissions();
      const hasExercisePermission = permissions.some(
        (p) => p.recordType === 'ExerciseSession' && p.accessType === 'read'
      );
      setHasExercisePermissions(hasExercisePermission);

      if (hasExercisePermission) {
        await fetchExerciseData();
      }
    } catch (err) {
      console.error('Error requesting exercise permissions:', err);
      setError('Failed to request exercise permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSettings = () => {
    openHealthSettings();
  };

  // Helper functions for formatting data
  const formatSleepTime = (isoString: string | null | undefined): string => {
    if (!isoString) return 'N/A';

    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();

    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  };

  const calculateSleepDuration = (startTime: string | null | undefined, endTime: string | null | undefined): number => {
    if (!startTime || !endTime) return 0;

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return end - start;
  };

  const formatDate = (isoString: string | null | undefined): string => {
    if (!isoString) return 'N/A';

    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
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
                  <>
                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Activity Permissions:</Text>
                      <Text style={[
                        styles.statusValue,
                        { color: hasPermissions ? '#00c853' : '#f44336' }
                      ]}>
                        {hasPermissions ? 'Granted' : 'Not Granted'}
                      </Text>
                    </View>

                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Sleep Permissions:</Text>
                      <Text style={[
                        styles.statusValue,
                        { color: hasSleepPermissions ? '#00c853' : '#f44336' }
                      ]}>
                        {hasSleepPermissions ? 'Granted' : 'Not Granted'}
                      </Text>
                    </View>

                    <View style={styles.statusRow}>
                      <Text style={styles.statusLabel}>Exercise Permissions:</Text>
                      <Text style={[
                        styles.statusValue,
                        { color: hasExercisePermissions ? '#00c853' : '#f44336' }
                      ]}>
                        {hasExercisePermissions ? 'Granted' : 'Not Granted'}
                      </Text>
                    </View>
                  </>
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

                  {isHealthConnectAvailable && (!hasPermissions || !hasSleepPermissions || !hasExercisePermissions) && (
                    <Pressable
                      style={styles.button}
                      onPress={handleRequestAllPermissions}
                    >
                      <Text style={styles.buttonText}>Request All Permissions</Text>
                    </Pressable>
                  )}

                  {isHealthConnectAvailable && !hasPermissions && (
                    <Pressable
                      style={styles.button}
                      onPress={handleRequestActivityPermissions}
                    >
                      <Text style={styles.buttonText}>Activity Permissions</Text>
                    </Pressable>
                  )}

                  {isHealthConnectAvailable && !hasSleepPermissions && (
                    <Pressable
                      style={styles.button}
                      onPress={handleRequestSleepPermissions}
                    >
                      <Text style={styles.buttonText}>Sleep Permissions</Text>
                    </Pressable>
                  )}

                  {isHealthConnectAvailable && !hasExercisePermissions && (
                    <Pressable
                      style={styles.button}
                      onPress={handleRequestExercisePermissions}
                    >
                      <Text style={styles.buttonText}>Exercise Permissions</Text>
                    </Pressable>
                  )}

                  {isHealthConnectAvailable && (hasPermissions || hasSleepPermissions || hasExercisePermissions) && (
                    <Pressable
                      style={styles.button}
                      onPress={() => {
                        if (hasPermissions) fetchHealthData();
                        if (hasSleepPermissions) fetchSleepData();
                        if (hasExercisePermissions) fetchExerciseData();
                      }}
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
                  <Text style={styles.cardTitle}>Activity Data (Last 7 Days)</Text>

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

                      {(!stepsData?.COUNT_TOTAL && !distanceData?.DISTANCE?.inMeters) && (
                        <Text style={styles.noDataText}>
                          No activity data available for the last 7 days. Try recording some activity with a fitness app that integrates with Health Connect.
                        </Text>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* Sleep Data Section */}
              {hasSleepPermissions && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Sleep Data (Last 7 Days)</Text>

                  {isLoadingData ? (
                    <View style={styles.centerContainer}>
                      <ActivityIndicator size="small" color="#0066cc" />
                      <Text style={styles.loadingText}>Loading sleep data...</Text>
                    </View>
                  ) : (
                    <>
                      {/* Weekly Total */}
                      <View style={styles.dataContainer}>
                        <Text style={styles.dataLabel}>Total Sleep:</Text>
                        <Text style={styles.dataValue}>
                          {sleepData?.SLEEP_DURATION_TOTAL
                            ? formatSleepDuration(sleepData.SLEEP_DURATION_TOTAL * 1000)
                            : 'No data'}
                        </Text>
                      </View>

                      {/* Last Night's Sleep */}
                      {lastNightSleep && (
                        <>
                          <Text style={styles.subheading}>Last Recorded Sleep:</Text>
                          <View style={styles.sleepDetail}>
                            <Text style={styles.sleepLabel}>Bedtime:</Text>
                            <Text style={styles.sleepValue}>{formatSleepTime(lastNightSleep.startTime)}</Text>
                          </View>
                          <View style={styles.sleepDetail}>
                            <Text style={styles.sleepLabel}>Wake time:</Text>
                            <Text style={styles.sleepValue}>{formatSleepTime(lastNightSleep.endTime)}</Text>
                          </View>
                          <View style={styles.sleepDetail}>
                            <Text style={styles.sleepLabel}>Duration:</Text>
                            <Text style={styles.sleepValue}>
                              {formatSleepDuration(calculateSleepDuration(
                                lastNightSleep.startTime,
                                lastNightSleep.endTime
                              ))}
                            </Text>
                          </View>
                          {lastNightSleep.notes && (
                            <View style={styles.sleepDetail}>
                              <Text style={styles.sleepLabel}>Notes:</Text>
                              <Text style={styles.sleepValue}>{lastNightSleep.notes}</Text>
                            </View>
                          )}

                          {/* Sleep Quality Assessment */}
                          {(() => {
                            const duration = calculateSleepDuration(
                              lastNightSleep.startTime,
                              lastNightSleep.endTime
                            );
                            const quality = getSleepQualityDescription(duration);
                            return (
                              <View style={[
                                styles.sleepQuality,
                                {
                                  backgroundColor:
                                    quality.quality === 'good' ? '#e8f5e9' :
                                      quality.quality === 'fair' ? '#fff8e1' :
                                        '#ffebee'
                                }
                              ]}>
                                <Text style={styles.sleepQualityText}>{quality.description}</Text>
                              </View>
                            );
                          })()}
                        </>
                      )}

                      {!lastNightSleep && !sleepData?.SLEEP_DURATION_TOTAL && (
                        <Text style={styles.noDataText}>
                          No sleep sessions recorded in the last 7 days. Try using a sleep tracking app that integrates with Health Connect.
                        </Text>
                      )}

                      <Text style={styles.dataSourceText}>
                        Data Sources: {sleepData?.dataOrigins?.join(', ') || 'None'}
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* Exercise Data Section */}
              {hasExercisePermissions && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Exercise Data (Last 7 Days)</Text>

                  {isLoadingData ? (
                    <View style={styles.centerContainer}>
                      <ActivityIndicator size="small" color="#0066cc" />
                      <Text style={styles.loadingText}>Loading exercise data...</Text>
                    </View>
                  ) : (
                    <>
                      {/* Total Exercise */}
                      <View style={styles.dataContainer}>
                        <Text style={styles.dataLabel}>Total Exercise:</Text>
                        <Text style={styles.dataValue}>
                          {exerciseData?.EXERCISE_DURATION_TOTAL?.inSeconds
                            ? formatExerciseDuration(exerciseData.EXERCISE_DURATION_TOTAL.inSeconds * 1000)
                            : '0m'}
                        </Text>
                      </View>

                      {/* Exercise Sessions */}
                      {exerciseSessions.length > 0 ? (
                        <>
                          <Text style={styles.subheading}>Recent Exercises:</Text>

                          {exerciseSessions.slice(0, 3).map((session, index) => {
                            const startDate = new Date(session.startTime);
                            const endDate = new Date(session.endTime);
                            const duration = endDate.getTime() - startDate.getTime();

                            // Get a more descriptive exercise type
                            let exerciseTypeName = getExerciseTypeName(session.exerciseType);
                            // Fall back to a default type if needed
                            if (exerciseTypeName === 'Unknown' && session.title) {
                              exerciseTypeName = session.title;
                            }

                            return (
                              <View key={index} style={styles.exerciseItem}>
                                <View style={styles.exerciseHeader}>
                                  <Text style={styles.exerciseType}>
                                    {exerciseTypeName}
                                  </Text>
                                  <Text style={styles.exerciseDate}>
                                    {formatDate(session.startTime)}
                                  </Text>
                                </View>

                                <View style={styles.exerciseDetails}>
                                  <View style={styles.exerciseDetail}>
                                    <FontAwesome name="clock-o" size={14} color="#666" />
                                    <Text style={styles.exerciseDetailText}>
                                      {formatExerciseDuration(duration)}
                                    </Text>
                                  </View>

                                  {session.energy && (
                                    <View style={styles.exerciseDetail}>
                                      <FontAwesome name="fire" size={14} color="#f57c00" />
                                      <Text style={styles.exerciseDetailText}>
                                        {session.energy.inKilocalories || 0} kcal
                                      </Text>
                                    </View>
                                  )}

                                  {session.distance && (
                                    <View style={styles.exerciseDetail}>
                                      <FontAwesome name="map-marker" size={14} color="#4caf50" />
                                      <Text style={styles.exerciseDetailText}>
                                        {(session.distance.inKilometers || 0).toFixed(2)} km
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {session.title && exerciseTypeName !== session.title && (
                                  <Text style={styles.exerciseTitle}>{session.title}</Text>
                                )}
                              </View>
                            );
                          })}

                          {exerciseSessions.length > 3 && (
                            <Text style={styles.moreExercises}>
                              +{exerciseSessions.length - 3} more exercises
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text style={styles.noDataText}>
                          No exercise sessions recorded in the last 7 days. Try recording workouts with a fitness app that integrates with Health Connect.
                        </Text>
                      )}

                      <Text style={styles.dataSourceText}>
                        Data Sources: {exerciseData?.dataOrigins?.join(', ') || 'None'}
                      </Text>
                    </>
                  )}
                </View>
              )}

              {/* Information Section */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>About Health Connect</Text>
                <Text style={styles.infoText}>
                  Health Connect allows apps to share health and fitness data with each other.
                  This enables MindMate to retrieve activity, sleep, and exercise data from Health Connect, even when collected by other apps.
                </Text>
                <Text style={styles.infoText}>
                  For this to work, you need:
                </Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletPoint}>• An Android device (Android 9 or higher)</Text>
                  <Text style={styles.bulletPoint}>• Health Connect app installed</Text>
                  <Text style={styles.bulletPoint}>• At least one health app that shares data with Health Connect</Text>
                </View>
                <Text style={styles.infoText}>
                  Tracking physical activity, sleep patterns, and exercise habits provides valuable insights into your mental wellbeing.
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
  // Sleep styles
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
  },
  sleepDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sleepLabel: {
    fontSize: 14,
    color: '#666',
  },
  sleepValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  sleepQuality: {
    marginTop: 16,
    padding: 12,
    borderRadius: 6,
  },
  sleepQualityText: {
    fontSize: 14,
    color: '#333',
  },
  // Exercise styles
  exerciseItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  exerciseDate: {
    fontSize: 14,
    color: '#666',
  },
  exerciseDetails: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  exerciseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  exerciseDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
  },
  exerciseTitle: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  moreExercises: {
    textAlign: 'center',
    color: '#2196F3',
    marginTop: 12,
    fontSize: 14,
  },
});