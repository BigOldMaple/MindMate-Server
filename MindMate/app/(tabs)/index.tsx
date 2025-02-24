// app/(tabs)/index.tsx
import { StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, router } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { buddyPeerApi, BuddyPeer, BuddyPeerRequest } from '@/services/buddyPeerApi';
import { useFocusEffect } from '@react-navigation/native';
import { checkInApi } from '@/services/checkInApi';

export default function HomeScreen() {
  const [buddyPeers, setBuddyPeers] = useState<BuddyPeer[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<BuddyPeerRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkInStatus, setCheckInStatus] = useState<{
    canCheckIn: boolean;
    nextCheckInTime?: Date;
  }>({ canCheckIn: true });

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
    const loadCheckInStatus = async () => {
      try {
        const status = await checkInApi.getCheckInStatus();
        setCheckInStatus(status);
      } catch (error) {
        console.error('Error loading check-in status:', error);
      }
    };

    loadCheckInStatus();
    const interval = setInterval(loadCheckInStatus, 2500); 

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
        onPress={() => router.push('./home/check_in')}
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
  },
});