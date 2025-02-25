import React, { useState, useCallback } from 'react';
import { StyleSheet, Pressable, RefreshControl, ActivityIndicator, View as RNView, StatusBar } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import { notificationsApi, Notification } from '@/services/notificationsApi';
import { useMemo } from 'react';
import { ScrollView, SectionList } from 'react-native';

// Mock data for fallback when API isn't available
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'support',
    title: 'Support Request',
    message: 'Sarah wants to check in with you',
    time: '5 min ago',
    read: false,
    actionable: true,
    actionRoute: '/messages/[id]',
    actionParams: { id: 'sarah123' }
  },
  {
    id: '2',
    type: 'wellness',
    title: 'Daily Check-in',
    message: 'Time for your daily wellness check',
    time: '1 hour ago',
    read: true,
    actionable: true,
    actionRoute: '/home/check_in'
  },
  {
    id: '3',
    type: 'community',
    title: 'New Community Post',
    message: 'New activity in Mindful Mornings group',
    time: '2 hours ago',
    read: false,
    actionable: true,
    actionRoute: '/community/[id]',
    actionParams: { id: 'mindful-mornings' }
  },
  {
    id: '4',
    type: 'alert',
    title: 'Wellness Alert',
    message: 'Your activity patterns have changed significantly over the past week',
    time: '3 hours ago',
    read: true
  },
  {
    id: '5',
    type: 'buddy',
    title: 'New Buddy Request',
    message: 'Michael would like to add you as a buddy peer',
    time: '1 day ago',
    read: false,
    actionable: true,
    actionRoute: '/home/support_network'
  },
  {
    id: '6',
    type: 'wellness',
    title: 'Sleep Pattern Change',
    message: 'Your sleep quality has improved this week',
    time: '2 days ago',
    read: true
  }
];

// Group notifications by date
const groupNotificationsByDate = (notifications: Notification[]) => {
  const groups: Record<string, Notification[]> = {};
  
  notifications.forEach(notification => {
    // Convert time string to an actual date for grouping
    let dateKey = 'Today';
    const time = typeof notification.time === 'string' ? notification.time : notification.time;
    
    if (typeof time === 'string') {
      if (time.includes('day')) {
        dateKey = time.includes('1 day') ? 'Yesterday' : 'Earlier';
      } else if (time.includes('hour') || time.includes('min')) {
        dateKey = 'Today';
      }
    } else {
      // If it's a Date object, format it appropriately
      const now = new Date();
      const notifDate = new Date(time);
      const diffTime = Math.abs(now.getTime() - notifDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        dateKey = 'Today';
      } else if (diffDays === 1) {
        dateKey = 'Yesterday';
      } else if (diffDays <= 7) {
        dateKey = 'This Week';
      } else {
        dateKey = 'Earlier';
      }
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(notification);
  });
  
  return groups;
};

export default function NotificationsScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Available filter options
  const filterOptions = [
    { key: null, label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'support', label: 'Support' },
    { key: 'wellness', label: 'Wellness' },
    { key: 'community', label: 'Community' }
  ];

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Call the notifications API
      const data = await notificationsApi.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
      
      // Fallback to mock data if the API fails
      setNotifications(MOCK_NOTIFICATIONS);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Refresh notifications
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchNotifications();
    setIsRefreshing(false);
  }, [fetchNotifications]);
  
  // Mark notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      
      // Optimistically update the UI
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, read: true } : notif
        )
      );
    } catch (err) {
      // If the API call fails, revert the optimistic update
      console.error('Failed to mark notification as read', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);
  
  // Delete notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.deleteNotification(id);
      
      // Optimistically update the UI
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    } catch (err) {
      // If the API call fails, revert the optimistic update
      console.error('Failed to delete notification', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);
  
  // Load notifications when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );
  
  // Filter notifications based on selected filter
  const filteredNotifications = useMemo(() => {
    if (!filter || filter === 'all') return notifications;
    
    if (filter === 'unread') {
      return notifications.filter(notif => !notif.read);
    }
    
    return notifications.filter(notif => notif.type === filter);
  }, [notifications, filter]);
  
  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);
  
  // Render notification item
  const renderNotificationItem = ({ item }: { item: Notification }) => (
    <Pressable 
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification
      ]}
      onPress={async () => {
        try {
          // First check if the notification has a valid ID
          if (!item.id) {
            console.error('Notification missing ID:', item);
            return;
          }

          console.log('Marking notification as read:', item.id);
          
          // Mark as read - wrap in try/catch to handle errors gracefully
          try {
            await markAsRead(item.id);
          } catch (error) {
            console.error('Error marking notification as read:', error);
            // Continue with navigation even if marking as read fails
          }
          
          // Navigate to action route if available
          if (item.actionable && item.actionRoute) {
            // Convert string route to a typed route
            if (item.actionRoute === '/messages/[id]' && item.actionParams?.id) {
              router.push({
                pathname: '/messages/[id]',
                params: { id: item.actionParams.id }
              });
            } else if (item.actionRoute === '/home/check_in') {
              router.push('/home/check_in');
            } else if (item.actionRoute === '/home/support_network') {
              router.push('/home/support_network');
            } else if (item.actionRoute === '/community/[id]' && item.actionParams?.id) {
              router.push({
                pathname: '/community/[id]',
                params: { id: item.actionParams.id }
              });
            } else {
              console.log('Unknown route:', item.actionRoute);
            }
          }
        } catch (error) {
          console.error('Error handling notification tap:', error);
        }
      }}
    >
      <View style={[
        styles.iconContainer,
        { 
          backgroundColor: 
            item.type === 'support' ? '#FFE4E4' :
            item.type === 'wellness' ? '#E3F2FD' :
            item.type === 'community' ? '#E8F5E9' :
            item.type === 'buddy' ? '#E1F5FE' :
            '#FFF3E0'
        }
      ]}>
        <FontAwesome 
          name={
            item.type === 'support' ? 'heart' :
            item.type === 'wellness' ? 'check-circle' :
            item.type === 'community' ? 'users' :
            item.type === 'buddy' ? 'user-plus' :
            'exclamation-circle'
          }
          size={20}
          color={
            item.type === 'support' ? '#FF4444' :
            item.type === 'wellness' ? '#2196F3' :
            item.type === 'community' ? '#4CAF50' :
            item.type === 'buddy' ? '#03A9F4' :
            '#FF9800'
          }
        />
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
      </View>

      <View style={styles.rightContainer}>
        <Text style={styles.time}>{typeof item.time === 'string' ? item.time : new Date(item.time).toLocaleDateString()}</Text>
        {!item.read && (
          <View style={styles.unreadDot} />
        )}
      </View>
    </Pressable>
  );
  
  // Render section header
  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );
  
  // Transform grouped notifications into sections for SectionList
  const sections = useMemo(() => {
    return Object.entries(groupedNotifications)
      .map(([title, data]) => ({ title, data }))
      .sort((a, b) => {
        // Custom sort logic to ensure Today > Yesterday > This Week > Earlier
        const order = { 'Today': 0, 'Yesterday': 1, 'This Week': 2, 'Earlier': 3 };
        return order[a.title as keyof typeof order] - order[b.title as keyof typeof order];
      });
  }, [groupedNotifications]);

  // Hide the default header
  React.useEffect(() => {
    // Configure the header to be hidden when this screen is focused
    return () => {}; // Return empty cleanup function
  }, []);

  if (isLoading && !isRefreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['right', 'left', 'bottom']}>
        {/* Hide the default header */}
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Custom Header */}
        <View style={styles.customHeader}>
          <View style={styles.headerLeft}>
            <Pressable 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <FontAwesome name="arrow-left" size={20} color="#666" />
            </Pressable>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>
          <View style={styles.headerAction} />
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left', 'bottom']}>
      {/* Hide the default header */}
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <View style={styles.headerLeft}>
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
        <Pressable 
          style={styles.headerAction}
          onPress={async () => {
            const unreadCount = notifications.filter(n => !n.read).length;
            if (unreadCount > 0) {
              try {
                await notificationsApi.markAllAsRead();
                // Update UI
                setNotifications(prev => 
                  prev.map(notif => ({ ...notif, read: true }))
                );
              } catch (error) {
                console.error('Failed to mark all as read:', error);
                fetchNotifications();
              }
            }
          }}
        >
          <Text style={styles.headerActionText}>
            Mark all read
          </Text>
        </Pressable>
      </View>
      {/* Filter options */}
      <RNView style={styles.filterContainer}>
        <ScrollView 
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {filterOptions.map(option => (
            <Pressable
              key={option.key}
              style={[
                styles.filterButton,
                filter === option.key && styles.activeFilterButton,
                { borderColor: Colors[colorScheme ?? 'light'].tint }
              ]}
              onPress={() => setFilter(option.key)}
            >
              <Text 
                style={[
                  styles.filterButtonText,
                  filter === option.key && styles.activeFilterButtonText,
                  { color: filter === option.key ? Colors[colorScheme ?? 'light'].background : Colors[colorScheme ?? 'light'].tint }
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </RNView>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable 
            style={[styles.retryButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
            onPress={fetchNotifications}
          >
            <Text style={[styles.retryButtonText, { color: Colors[colorScheme ?? 'light'].background }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="bell-o" size={64} color="#CCCCCC" />
          <Text style={styles.emptyText}>
            {filter 
              ? `No ${filter === 'unread' ? 'unread' : filter} notifications`
              : 'No notifications yet'
            }
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderNotificationItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[Colors[colorScheme ?? 'light'].tint]}
              tintColor={Colors[colorScheme ?? 'light'].tint}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 80, // Match standard header height
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 4,
  },
  headerAction: {
    padding: 8,
  },
  headerActionText: {
    fontSize: 14,
    color: '#2196F3',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  filterScrollContent: {
    paddingRight: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  activeFilterButton: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 13,
  },
  activeFilterButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  unreadNotification: {
    backgroundColor: '#F8FAFD',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    color: '#666',
  },
  rightContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  time: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#F5F6FA',
    padding: 8,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});