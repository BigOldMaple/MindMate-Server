// MindMate/components/SupportRequestsSection.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import { router } from 'expo-router';
import { mentalHealthApi } from '@/services/mentalHealthApi';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SupportRequestsSection() {
  const [isLoading, setIsLoading] = useState(true);
  const [buddyRequests, setBuddyRequests] = useState(0);
  const [communityRequests, setCommunityRequests] = useState(0);
  const [globalRequests, setGlobalRequests] = useState(0);

  useEffect(() => {
    fetchSupportRequests();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchSupportRequests, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSupportRequests = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all types of requests
      const [buddyReqs, communityReqs, globalReqs] = await Promise.all([
        mentalHealthApi.getBuddySupportRequests(),
        mentalHealthApi.getCommunitySupportRequests(),
        mentalHealthApi.getGlobalSupportRequests()
      ]);
      
      setBuddyRequests(buddyReqs.length);
      setCommunityRequests(communityReqs.length);
      setGlobalRequests(globalReqs.length);
    } catch (error) {
      console.error('Failed to fetch support requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show if there are no requests
  const totalRequests = buddyRequests + communityRequests + globalRequests;
  if (totalRequests === 0 && !isLoading) {
    return null;
  }

  return (
    <View style={styles.supportCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Support Requests</Text>
        <Pressable onPress={fetchSupportRequests} style={styles.refreshButton}>
          <FontAwesome name="refresh" size={16} color="#2196F3" />
        </Pressable>
      </View>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#2196F3" />
        </View>
      ) : (
        <View style={styles.supportOptions}>
          {buddyRequests > 0 && (
            <Pressable 
              style={[styles.supportOption, { backgroundColor: '#E3F2FD' }]}
              onPress={() => router.push('/buddy-support')}
            >
              <View style={styles.optionContent}>
                <FontAwesome name="heart" size={20} color="#2196F3" />
                <Text style={styles.optionText}>Buddy</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{buddyRequests}</Text>
                </View>
              </View>
            </Pressable>
          )}
          
          {communityRequests > 0 && (
            <Pressable 
              style={[styles.supportOption, { backgroundColor: '#E8F5E9' }]}
              onPress={() => router.push('/community-support')}
            >
              <View style={styles.optionContent}>
                <FontAwesome name="users" size={20} color="#4CAF50" />
                <Text style={styles.optionText}>Community</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{communityRequests}</Text>
                </View>
              </View>
            </Pressable>
          )}
          
          {globalRequests > 0 && (
            <Pressable 
              style={[styles.supportOption, { backgroundColor: '#F3E5F5' }]}
              onPress={() => router.push('/global-support')}
            >
              <View style={styles.optionContent}>
                <FontAwesome name="globe" size={20} color="#9C27B0" />
                <Text style={styles.optionText}>Global</Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{globalRequests}</Text>
                </View>
              </View>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  supportCard: {
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
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  supportOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  supportOption: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  optionContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4081',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});