// MindMate/app/global-support.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, Pressable, Alert, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, Stack } from 'expo-router';
import { mentalHealthApi, PopulatedSupportRequest } from '@/services/mentalHealthApi';
import { chatApi } from '@/services/chatApi';

// Update the interface to match our new PopulatedSupportRequest type
interface SupportRequest extends PopulatedSupportRequest {
  // Any additional properties specific to this component can be added here
}

export default function GlobalSupportScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);

  useEffect(() => {
    fetchSupportRequests();
    
    // Set up refresh interval (every 60 seconds)
    const refreshInterval = setInterval(fetchSupportRequests, 60000);
    
    // Clean up interval on unmount
    return () => clearInterval(refreshInterval);
  }, []);

  const fetchSupportRequests = async () => {
    try {
      setIsLoading(true);
      const requests = await mentalHealthApi.getGlobalSupportRequests();
      setSupportRequests(requests);
    } catch (error) {
      console.error('Failed to fetch support requests:', error);
      Alert.alert('Error', 'Failed to load support requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProvideSupport = async (assessmentId: string, userId: string, username: string) => {
    try {
      Alert.alert(
        'Provide Support',
        `Are you sure you want to provide support to ${username}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              try {
                // 1. Provide support
                await mentalHealthApi.provideSupport(assessmentId);
                
                // 2. Get or create conversation
                const conversationId = await chatApi.createConversation(userId);
                
                // 3. Navigate with conversation ID instead of username
                router.push(`/messages/${conversationId}`);
                
                Alert.alert('Success', 'You have offered your support');
                fetchSupportRequests();
              } catch (error) {
                console.error('Failed to provide support:', error);
                Alert.alert('Error', 'Failed to provide support');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Support confirmation error:', error);
    }
  };

  const renderSupportRequestItem = ({ item }: { item: SupportRequest }) => {
    const userId = item.userId._id.toString();
    const userName = item.userId.profile.name || item.userId.username;
    const status = item.mentalHealthStatus;
    const statusColors = {
      stable: '#4CAF50',
      declining: '#FFC107',
      critical: '#F44336'
    };
    
    // Format time ago
    const getTimeAgo = (timestamp: string) => {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      
      if (minutes < 1) return 'just now';
      if (minutes < 60) return `${minutes} min ago`;
      
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hr ago`;
      
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    };
    
    const timeAgo = getTimeAgo(item.supportRequestTime);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColors[status] }]}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>
        <View style={styles.requestActions}>
          <Text style={styles.requestText}>
            A user on the platform might need support
          </Text>
          <Pressable
            style={styles.supportButton}
            onPress={() => handleProvideSupport(item._id, userId, item.userId.username)}
          >
            <FontAwesome name="globe" size={16} color="white" />
            <Text style={styles.supportButtonText}>Provide Global Support</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Global Support Requests',
        headerShown: true
      }} />
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading support requests...</Text>
          </View>
        ) : supportRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FontAwesome name="globe" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>No global support requests at this time</Text>
            <Pressable style={styles.refreshButton} onPress={fetchSupportRequests}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={supportRequests}
            renderItem={renderSupportRequestItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            refreshing={isLoading}
            onRefresh={fetchSupportRequests}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  // Styles remain unchanged
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  timeAgo: {
    fontSize: 12,
    color: '#666',
  },
  requestText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  requestActions: {
    marginTop: 8,
  },
  supportButton: {
    backgroundColor: '#9C27B0', // Different color for global support
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  supportButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
});