import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert, Platform } from 'react-native';
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
import TriggerAnalysisButton from '@/components/TriggerAnalysisButton';
import ClearAnalysisButton from '@/components/ClearAnalysisButton';


export default function HomeScreen() {
  const [buddyPeers, setBuddyPeers] = useState<BuddyPeer[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<BuddyPeerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkInStatus, setCheckInStatus] = useState<{
    canCheckIn: boolean;
    nextCheckInTime?: Date;
  }>({ canCheckIn: true });

  // Use refs to track previous check-in status reliably across renders
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

  // Load initial data
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
    // Define the proper interface for the check-in status
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

  // Add this additional effect to check notifications on app focus
  // But now with a cooldown to prevent duplicate notifications
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

  // Add this additional effect to check notifications on app focus
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        // Explicitly check if check-in is available
        const result = await notificationsApi.checkForCheckInStatus();
        if (result) {
          console.log('Check-in is available, created local notification');
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

  const formatTimeRemaining = (nextTime: Date) => {
    const now = new Date();
    const diff = nextTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <View style={styles.container}>
      {/* Current Wellness Card */}
      <View style={styles.wellnessCard}>
        <View style={styles.wellnessHeader}>
          <Text style={styles.cardTitle}>Current Wellness</Text>
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

      {/* Check In Button */}
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
        <FontAwesome
          name="heart"
          size={20}
          color={checkInStatus.canCheckIn ? "#FF4081" : "#999"}
        />
        <Text style={[
          styles.checkInText,
          !checkInStatus.canCheckIn && styles.checkInTextDisabled
        ]}>
          {checkInStatus.canCheckIn
            ? 'Check In'
            : `Next Check-in in ${formatTimeRemaining(new Date(checkInStatus.nextCheckInTime!))}`
          }
        </Text>
      </Pressable>

      {/* Health Data Sync Button */}
      <SyncHealthDataButton />

      {/* Mental Health Analysis Button (Dev Only) */}
      <TriggerAnalysisButton />

      {/* Clear Mental Health Data Button (Dev Only) */}
      <ClearAnalysisButton />

      {/* Support Network Card */}
      <View style={styles.networkCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Support Network</Text>
          <Link href="./home/support_network" style={styles.manageLink}>
            <Text style={styles.manageLinkText}>Manage</Text>
          </Link>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F5F6FA',
  },
  wellnessCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  wellnessHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    marginRight: 16,
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
    marginBottom: 8,
  },
  metricLabel: {
    width: 60,
    fontSize: 14,
    color: '#666',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  checkInButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  checkInText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FF4081',
  },
  networkCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  manageLink: {
    padding: 4,
  },
  manageLinkText: {
    color: '#2196F3',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  communitiesCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  communityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  communityName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  communityStats: {
    fontSize: 12,
    color: '#666',
  },
  joinButton: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  joinButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInButtonDisabled: {
    opacity: 0.6,
  },
  checkInTextDisabled: {
    color: '#999',
  }
});