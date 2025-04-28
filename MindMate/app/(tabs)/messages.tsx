import { StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, View as RNView } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { chatApi, ChatPreview } from '@/services/chatApi';
import { useFocusEffect } from '@react-navigation/native';
import { buddyPeerApi } from '@/services/buddyPeerApi';

// Define the relationship categories
type RelationshipCategory = 'buddyPeers' | 'community' | 'global';

export default function MessagesScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allChats, setAllChats] = useState<ChatPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<RelationshipCategory>('buddyPeers');
  const [buddyPeerIds, setBuddyPeerIds] = useState<string[]>([]);
  const [communityMemberIds, setCommunityMemberIds] = useState<string[]>([]);
  const router = useRouter();

  // Categorized chats
  const categorizedChats = useCategorizedChats(allChats, buddyPeerIds, communityMemberIds);

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  const loadInitialData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchChats(),
      fetchRelationshipData()
    ]);
    setIsLoading(false);
  };

  const fetchChats = async () => {
    try {
      const conversations = await chatApi.getConversations();
      setAllChats(conversations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
      console.error('Error fetching chats:', err);
    }
  };

  const fetchRelationshipData = async () => {
    try {
      // Fetch buddy peers
      const buddyPeers = await buddyPeerApi.getBuddyPeers();
      setBuddyPeerIds(buddyPeers.map(peer => peer.userId));

      // TODO: Fetch community members
      // For now we'll use empty array or mock data
      // Normally, you would fetch this from your community API
      setCommunityMemberIds([]);
    } catch (error) {
      console.error('Error fetching relationship data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  const handleChatPress = (chatId: string) => {
    router.push({
      pathname: '/messages/[id]',
      params: { id: chatId }
    });
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={loadInitialData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // Get chats for the active category
  const activeCategoryChats = categorizedChats[activeCategory] || [];

  return (
    <View style={styles.container}>
      {/* Relationship Category Tabs */}
      <View style={styles.categoryTabsContainer}>
        <Pressable
          style={[
            styles.categoryTab,
            activeCategory === 'buddyPeers' && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory('buddyPeers')}
        >
          <FontAwesome 
            name="heart" 
            size={16} 
            color={activeCategory === 'buddyPeers' ? '#2196F3' : '#666'} 
            style={styles.categoryIcon}
          />
          <Text 
            style={[
              styles.categoryText,
              activeCategory === 'buddyPeers' && styles.activeCategoryText
            ]}
          >
            Buddy Peers
          </Text>
          {categorizedChats.buddyPeers.length > 0 && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{categorizedChats.buddyPeers.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.categoryTab,
            activeCategory === 'community' && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory('community')}
        >
          <FontAwesome 
            name="users" 
            size={16} 
            color={activeCategory === 'community' ? '#4CAF50' : '#666'} 
            style={styles.categoryIcon}
          />
          <Text 
            style={[
              styles.categoryText,
              activeCategory === 'community' && styles.activeCategoryText
            ]}
          >
            Community
          </Text>
          {categorizedChats.community.length > 0 && (
            <View style={[styles.categoryBadge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.categoryBadgeText}>{categorizedChats.community.length}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[
            styles.categoryTab,
            activeCategory === 'global' && styles.activeCategoryTab
          ]}
          onPress={() => setActiveCategory('global')}
        >
          <FontAwesome 
            name="globe" 
            size={16} 
            color={activeCategory === 'global' ? '#9C27B0' : '#666'} 
            style={styles.categoryIcon}
          />
          <Text 
            style={[
              styles.categoryText,
              activeCategory === 'global' && styles.activeCategoryText
            ]}
          >
            Global
          </Text>
          {categorizedChats.global.length > 0 && (
            <View style={[styles.categoryBadge, { backgroundColor: '#9C27B0' }]}>
              <Text style={styles.categoryBadgeText}>{categorizedChats.global.length}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <FontAwesome name="search" size={20} color="#666" style={styles.searchIcon} />
        <Text style={styles.searchText}>Search messages...</Text>
      </View>

      {/* Messages List */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Active Category Title */}
        <View style={styles.categoryHeaderContainer}>
          <Text style={styles.categoryHeaderText}>
            {activeCategory === 'buddyPeers' ? 'Buddy Peers' : 
             activeCategory === 'community' ? 'Community Members' : 'Global Users'}
          </Text>
          <Text style={styles.categoryCount}>
            {activeCategoryChats.length} {activeCategoryChats.length === 1 ? 'conversation' : 'conversations'}
          </Text>
        </View>

        {activeCategoryChats.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No Messages in This Category</Text>
            <Text style={styles.emptyStateText}>
              {activeCategory === 'buddyPeers' 
                ? 'Start a conversation with your buddy peers'
                : activeCategory === 'community'
                ? 'Connect with members of your communities'
                : 'Reach out to other users on the platform'}
            </Text>
          </View>
        ) : (
          activeCategoryChats.map((chat) => (
            <Pressable
              key={chat.id}
              style={styles.chatCard}
              onPress={() => handleChatPress(chat.id)}
            >
              <View style={styles.chatContent}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <View style={[
                    styles.avatar,
                    activeCategory === 'buddyPeers' ? styles.buddyAvatar :
                    activeCategory === 'community' ? styles.communityAvatar :
                    styles.globalAvatar
                  ]}>
                    <FontAwesome 
                      name={
                        activeCategory === 'buddyPeers' ? 'heart' :
                        activeCategory === 'community' ? 'users' : 'user'
                      } 
                      size={24} 
                      color={
                        activeCategory === 'buddyPeers' ? '#2196F3' :
                        activeCategory === 'community' ? '#4CAF50' : '#9C27B0'
                      } 
                    />
                  </View>
                </View>

                {/* Chat Details */}
                <View style={styles.chatDetails}>
                  <View style={styles.chatHeader}>
                    <View style={styles.nameContainer}>
                      <Text style={styles.name}>
                        {chat.participant?.name || 'Unknown'}
                      </Text>
                      {chat.participant?.isVerifiedProfessional && (
                        <View style={styles.professionalBadge}>
                          <FontAwesome name="check-circle" size={12} color="#2196F3" />
                          <Text style={styles.professionalBadgeText}>Professional</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.time}>
                      {chat.lastMessage ? formatTimestamp(chat.lastMessage.timestamp) : ''}
                    </Text>
                  </View>
                  
                  <Text style={styles.username}>
                    @{chat.participant?.username || 'unknown'}
                  </Text>
                  
                  <Text 
                    style={[
                      styles.lastMessage,
                      chat.unreadCount > 0 && styles.unreadMessage
                    ]} 
                    numberOfLines={1}
                  >
                    {chat.lastMessage?.content || 'No messages yet'}
                  </Text>
                </View>
              </View>

              {/* Unread Badge */}
              {chat.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{chat.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* New Message Button */}
      <Pressable 
        style={styles.newMessageButton}
        onPress={() => router.push('/messages/new')}
      >
        <FontAwesome name="edit" size={20} color="white" />
      </Pressable>
    </View>
  );
}

// Custom hook to categorize chats
function useCategorizedChats(
  chats: ChatPreview[], 
  buddyPeerIds: string[], 
  communityMemberIds: string[]
) {
  // Initialize categories
  const categorized = {
    buddyPeers: [] as ChatPreview[],
    community: [] as ChatPreview[],
    global: [] as ChatPreview[]
  };

  // Categorize each chat
  chats.forEach(chat => {
    const participantId = chat.participant?.id;
    
    if (!participantId) {
      return; // Skip if no participant (shouldn't happen)
    }

    // Check if participant is a buddy peer
    if (buddyPeerIds.includes(participantId)) {
      categorized.buddyPeers.push(chat);
    }
    // Check if participant is a community member
    else if (communityMemberIds.includes(participantId)) {
      categorized.community.push(chat);
    }
    // Otherwise, it's a global user
    else {
      categorized.global.push(chat);
    }
  });

  return categorized;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    color: '#FF3B30',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  categoryTabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    position: 'relative',
  },
  activeCategoryTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeCategoryText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  categoryIcon: {
    marginRight: 6,
  },
  categoryBadge: {
    position: 'absolute',
    top: -2,
    right: 12,
    backgroundColor: '#2196F3',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  categoryHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  categoryCount: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchText: {
    color: '#666',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  chatContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buddyAvatar: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  communityAvatar: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  globalAvatar: {
    backgroundColor: 'rgba(156, 39, 176, 0.1)',
  },
  chatDetails: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  professionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  professionalBadgeText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },
  time: {
    fontSize: 12,
    color: '#666',
  },
  username: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  unreadMessage: {
    color: '#000',
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#2196F3',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  newMessageButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#2196F3',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});