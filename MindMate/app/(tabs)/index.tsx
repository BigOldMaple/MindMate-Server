import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert, Platform, ScrollView, RefreshControl } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, router } from 'expo-router';
import { buddyPeerApi, BuddyPeer, BuddyPeerRequest } from '@/services/buddyPeerApi';
import { useFocusEffect } from '@react-navigation/native';
import { checkInApi } from '@/services/checkInApi';
import { notificationService } from '@/services/notificationService';
import { notificationsApi } from '@/services/notificationsApi';
import * as SecureStore from 'expo-secure-store';
import SyncHealthDataButton from '@/components/SyncHealthDataButton';
import EstablishBaselineButton from '@/components/EstablishBaselineButton';
import AnalyzeRecentButton from '@/components/AnalyzeRecentButton';
import ClearAnalysisButton from '@/components/ClearAnalysisButton';
import SupportRequestsSection from '@/components/SupportRequestsSection';


export default function HomeScreen() {
  const [buddyPeers, setBuddyPeers] = useState<BuddyPeer[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<BuddyPeerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<{
    canCheckIn: boolean;
    nextCheckInTime?: Date;
  }>({ canCheckIn: true });

  // Reference to track previous check-in status
  const prevCheckInStatusRef = useRef<boolean>(true);

  const loadBuddyData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [peers, requests] = await Promise.all([
        buddyPeerApi.getBuddyPeers(),
        buddyPeerApi.getPendingRequests()
      ]);
      setBuddyPeers(peers);
      setPendingRequests(requests);
      setActiveCount(Math.floor(peers.length / 2));
    } catch (error) {
      console.error('Failed to load buddy data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    loadBuddyData();
  }, []);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadBuddyData();
    }, [loadBuddyData])
  );

  useEffect(() => {
    interface CheckInStatusType {
      canCheckIn: boolean;
      nextCheckInTime?: Date;
      notificationCreated?: boolean;
      notificationId?: string;
    }

    const loadCheckInStatus = async () => {
      try {
        const status = await checkInApi.getCheckInStatus();

        // Update state
        setCheckInStatus(status);

        // Detect transitions from cooldown to available
        const wasInCooldown = !prevCheckInStatusRef.current;
        const isNowAvailable = status.canCheckIn;

        // If transitioning from cooldown to available, send a local notification
        if (wasInCooldown && isNowAvailable) {
          console.log('Check-in is now available after cooldown');

          // Import the notificationTracker
          const { notificationTracker } = require('../../services/notificationTracker');

          // Only show notification if we haven't already shown one for this cycle
          const hasShown = await notificationTracker.hasShownCheckInNotification();
          if (!hasShown) {
            // Create a local notification
            await notificationService.sendLocalNotification(
              'Check-In Available',
              'Your next check-in is now available. How are you feeling today?',
              {
                type: 'wellness',
                actionable: true,
                actionRoute: '/home/check_in'
              }
            );

            // Mark that we've shown a notification for this cycle
            await notificationTracker.markCheckInNotificationShown();
          }

          // Set flag to refresh notifications
          await SecureStore.setItemAsync('shouldRefreshNotifications', 'true');

          // Fetch notifications to update the badge count
          try {
            await notificationsApi.getNotifications();
          } catch (error) {
            console.error('Error refreshing notifications:', error);
          }
        }

        // Update the previous status ref for next comparison
        prevCheckInStatusRef.current = status.canCheckIn;
      } catch (error) {
        console.error('Error loading check-in status:', error);
      }
    };

    // Load initial status
    loadCheckInStatus();

    // Use a shorter interval of 15 seconds to be more responsive about status changes
    const interval = setInterval(loadCheckInStatus, 15000);

    return () => clearInterval(interval);
  }, []);

  // Additional effect for check-in notification
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        // Import the notificationTracker
        const { notificationTracker } = require('../../services/notificationTracker');

        // Only check for notification status if we haven't shown one recently
        const hasShown = await notificationTracker.hasShownCheckInNotification();
        if (!hasShown) {
          // Explicitly check if check-in is available
          const result = await notificationsApi.checkForCheckInStatus();
          if (result) {
            console.log('Check-in is available, created local notification');
          }
        }
      } catch (error) {
        console.error('Error checking notifications on focus:', error);
      }
    };

    // Initial check
    checkNotifications();

    // Set up an interval to check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Format time remaining for check-in cooldown
  const formatTimeRemaining = (nextTime: Date) => {
    const now = new Date();
    const diff = nextTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBuddyData();
    setRefreshing(false);
  }, [loadBuddyData]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Wellness Overview Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.wellnessCard}>
          <View style={styles.wellnessHeader}>
            <Text style={styles.cardTitle}>Current Wellness</Text>
            <Pressable
              style={styles.moreButton}
              // Remove invalid route and replace with a placeholder alert for now
              onPress={() => Alert.alert("Wellness Insights", "This feature is coming soon!")}
            >
              <Text style={styles.moreButtonText}>Details</Text>
            </Pressable>
          </View>
          <View style={styles.wellnessContent}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreText}>85%</Text>
            </View>
            <View style={styles.metricsContainer}>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Sleep:</Text>
                <Text style={styles.metricValue}>7.5hrs</Text>
                <View style={[styles.statusPill, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.statusText, { color: '#2E7D32' }]}>Stable</Text>
                </View>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Activity:</Text>
                <Text style={styles.metricValue}>Low</Text>
                <View style={[styles.statusPill, { backgroundColor: '#FFE0B2' }]}>
                  <Text style={[styles.statusText, { color: '#E65100' }]}>Decreasing</Text>
                </View>
              </View>
              <View style={styles.metricRow}>
                <Text style={styles.metricLabel}>Social:</Text>
                <Text style={styles.metricValue}>Moderate</Text>
                <View style={[styles.statusPill, { backgroundColor: '#E3F2FD' }]}>
                  <Text style={[styles.statusText, { color: '#1565C0' }]}>Increasing</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Check-in Action Button */}
      <View style={styles.actionContainer}>
        <Pressable
          style={[
            styles.checkInButton,
            !checkInStatus.canCheckIn && styles.checkInButtonDisabled
          ]}
          onPress={() => {
            if (checkInStatus.canCheckIn) {
              router.push('./home/check_in');
            } else {
              // Show a message about when the next check-in will be available
              Alert.alert(
                'Check-In Not Available',
                `You have already completed your check-in for today. Next check-in will be available ${checkInStatus.nextCheckInTime
                  ? `at ${new Date(checkInStatus.nextCheckInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on ${new Date(checkInStatus.nextCheckInTime).toLocaleDateString()
                  }`
                  : 'later'
                }.`
              );
            }
          }}
          disabled={!checkInStatus.canCheckIn}
        >
          {checkInStatus.canCheckIn ? (
            <>
              <FontAwesome name="heart" size={20} color="#FFFFFF" />
              <Text style={styles.checkInText}>Check In Now</Text>
            </>
          ) : (
            <>
              <FontAwesome name="clock-o" size={20} color="#999" />
              <Text style={styles.checkInTextDisabled}>
                Next Check-in in {formatTimeRemaining(new Date(checkInStatus.nextCheckInTime!))}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Support Requests Section */}
      <View style={styles.sectionContainer}>
        <SupportRequestsSection />
      </View>

      {/* Support Network Card */}
      <View style={styles.sectionContainer}>
        <View style={styles.networkCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Support Network</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push('/support-statistics')} style={styles.statsLink}>
                <FontAwesome name="bar-chart" size={16} color="#2196F3" />
              </Pressable>
              <Link href="./home/support_network" style={styles.manageLink}>
                <Text style={styles.manageLinkText}>Manage</Text>
              </Link>
            </View>
          </View>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2196F3" />
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{buddyPeers.length}</Text>
                <Text style={styles.statLabel}>Buddy Peers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{activeCount}</Text>
                <Text style={styles.statLabel}>Active Now</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{pendingRequests.length}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Developer Options Section - Collapsible */}
      <View style={styles.sectionContainer}>
        <Pressable
          style={styles.devOptionsHeader}
          onPress={() => setShowDevOptions(!showDevOptions)}
        >
          <Text style={styles.devOptionsTitle}>Developer Options</Text>
          <FontAwesome
            name={showDevOptions ? "chevron-up" : "chevron-down"}
            size={16}
            color="#666"
          />
        </Pressable>

        {showDevOptions && (
          <View style={styles.devOptionsContent}>
            {/* Mental Health Analysis Section */}
            <Text style={styles.devOptionsSubtitle}>Mental Health Analysis</Text>
            <EstablishBaselineButton />
            <AnalyzeRecentButton />
            <ClearAnalysisButton />

            {/* Add a new Testing Tools Section */}
            <Text style={[styles.devOptionsSubtitle, { marginTop: 16 }]}>Testing Tools</Text>
            <Pressable
              style={styles.testButton}
              onPress={() => router.push('./test/health-data-generator')}
            >
              <FontAwesome name="flask" size={16} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.testButtonText}>Health Data Test Generator</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  contentContainer: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  // Wellness Card Styles
  wellnessCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  wellnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  moreButton: {
    padding: 6,
  },
  moreButtonText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  wellnessContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  metricsContainer: {
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricLabel: {
    width: 60,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
    minWidth: 60,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Check-in Button Styles
  actionContainer: {
    marginBottom: 24,
  },
  checkInButton: {
    backgroundColor: '#FF4081',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  checkInButtonDisabled: {
    backgroundColor: '#F5F5F5',
    shadowOpacity: 0.1,
  },
  checkInText: {
    marginLeft: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkInTextDisabled: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },

  // Network Card Styles
  networkCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsLink: {
    padding: 8,
    marginRight: 8,
  },
  manageLink: {
    padding: 6,
  },
  manageLinkText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Health Sync Card Styles
  syncCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  syncButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncViewDetails: {
    padding: 6,
  },
  syncViewDetailsText: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
  },
  syncButtonContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Developer Options Styles
  devOptionsHeader: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  devOptionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  devOptionsContent: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -1, // Connect with the header
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  devOptionsSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#9C27B0', 
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 6,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
});