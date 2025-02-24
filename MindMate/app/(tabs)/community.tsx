// app/(tabs)/community.tsx
import { StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { useRouter } from 'expo-router';
import { Community, communityApi } from '@/server/services/communityApi';
import React from 'react';

export default function CommunityScreen() {
    const [activeTab, setActiveTab] = useState('my-communities');
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [myCommunities, setMyCommunities] = useState<Community[]>([]);
    const [discoverCommunities, setDiscoverCommunities] = useState<Community[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCommunities = async () => {
        try {
            setIsLoading(true);
            const data = await communityApi.fetchAllCommunities();
            const myComms = data.filter((comm: Community) => comm.isUserMember);
            const discoverComms = data.filter((comm: Community) => !comm.isUserMember);

            setMyCommunities(myComms);
            setDiscoverCommunities(discoverComms);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const searchCommunities = async (query: string) => {
        try {
            setIsSearching(true);
            const data = await communityApi.searchCommunities(query);
            setDiscoverCommunities(data.filter((comm: Community) => !comm.isUserMember));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to search communities');
        } finally {
            setIsSearching(false);
        }
    };

    const debouncedSearch = useCallback(
        debounce((query: string) => {
            if (query.trim()) {
                searchCommunities(query);
            } else {
                fetchCommunities();
            }
        }, 500),
        []
    );

    useEffect(() => {
        fetchCommunities();
    }, []);

    useEffect(() => {
        if (activeTab === 'discover') {
            debouncedSearch(searchQuery);
        }
        return () => {
            debouncedSearch.cancel();
        };
    }, [searchQuery, activeTab]);

    const handleJoinCommunity = async (communityId: string) => {
        try {
            await communityApi.joinCommunity(communityId);
            await fetchCommunities();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to join community');
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
                <Pressable style={styles.retryButton} onPress={fetchCommunities}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    return (
      <View style={styles.container}>
          <View style={styles.tabsContainer}>
              <Pressable 
                  style={[styles.tabButton, activeTab === 'my-communities' && styles.activeTabButton]} 
                  onPress={() => setActiveTab('my-communities')}
              >
                  <Text style={[styles.tabButtonText, activeTab === 'my-communities' && styles.activeTabButtonText]}>
                      My Communities
                  </Text>
              </Pressable>
              <Pressable 
                  style={[styles.tabButton, activeTab === 'discover' && styles.activeTabButton]}
                  onPress={() => setActiveTab('discover')}
              >
                  <Text style={[styles.tabButtonText, activeTab === 'discover' && styles.activeTabButtonText]}>
                      Discover
                  </Text>
              </Pressable>
          </View>

          {activeTab === 'my-communities' ? (
              <ScrollView style={styles.communitiesList}>
                  {myCommunities.length === 0 ? (
                      <View style={styles.emptyState}>
                          <Text style={styles.emptyStateText}>You haven't joined any communities yet</Text>
                      </View>
                  ) : (
                      myCommunities.map((community) => (
                          <CommunityCard 
                              key={community._id} 
                              community={community}
                              onPress={() => router.push({ 
                                  pathname: "/community/[id]", 
                                  params: { id: community._id }
                              })}
                          />
                      ))
                  )}
              </ScrollView>
          ) : (
              <>
                  <View style={styles.searchContainer}>
                      <FontAwesome name="search" size={16} color="#666" />
                      <TextInput 
                          style={styles.searchInput}
                          placeholder="Search communities..."
                          placeholderTextColor="#666"
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                      />
                      {isSearching && (
                          <ActivityIndicator size="small" color="#2196F3" style={styles.searchSpinner} />
                      )}
                  </View>

                  <ScrollView style={styles.communitiesList}>
                      {discoverCommunities.length === 0 ? (
                          <View style={styles.emptyState}>
                              <Text style={styles.emptyStateText}>
                                  {searchQuery.trim() 
                                      ? 'No communities found matching your search'
                                      : 'No communities available to join'}
                              </Text>
                          </View>
                      ) : (
                          discoverCommunities.map((community) => (
                              <CommunityCard 
                                  key={community._id} 
                                  community={community}
                                  onPress={() => router.push({ 
                                      pathname: "/community/[id]", 
                                      params: { id: community._id }
                                  })}
                                  onJoin={() => handleJoinCommunity(community._id)}
                                  showJoinButton
                              />
                          ))
                      )}
                  </ScrollView>
              </>
          )}
      </View>
  );
}

interface CommunityCardProps {
  community: Community;
  onPress: () => void;
  onJoin?: () => void;
  showJoinButton?: boolean;
}

function CommunityCard({ community, onPress, onJoin, showJoinButton }: CommunityCardProps) {
  return (
      <Pressable 
          style={styles.communityCard}
          onPress={onPress}
      >
          <View style={styles.cardHeader}>
              <View style={styles.titleContainer}>
                  <Text style={styles.communityName}>{community.name}</Text>
                  {community.type === 'professional' && (
                      <FontAwesome name="check-circle" size={16} color="#2196F3" style={styles.verifiedIcon} />
                  )}
              </View>
              {showJoinButton && (
                  <Pressable 
                      style={styles.joinButton}
                      onPress={(e) => {
                          e.stopPropagation();
                          onJoin?.();
                      }}
                  >
                      <Text style={styles.joinButtonText}>Join</Text>
                  </Pressable>
              )}
          </View>
          <Text style={styles.description}>{community.description}</Text>
          <Text style={styles.memberCount}>
              {community.memberCount} {community.memberCount === 1 ? 'Member' : 'Members'}
          </Text>
      </Pressable>
  );
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
  tabsContainer: {
      flexDirection: 'row',
      backgroundColor: '#fff',
      padding: 8,
      gap: 8,
  },
  tabButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 24,
      backgroundColor: '#f5f6fa',
      alignItems: 'center',
      justifyContent: 'center',
  },
  activeTabButton: {
      backgroundColor: '#2196F3',
  },
  tabButtonText: {
      color: '#666',
      fontSize: 14,
  },
  activeTabButtonText: {
      color: '#fff',
  },
  searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      margin: 16,
      padding: 12,
      backgroundColor: '#fff',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#E0E0E0',
  },
  searchInput: {
      marginLeft: 8,
      flex: 1,
      fontSize: 14,
      color: '#666',
      padding: 0,
  },
  searchSpinner: {
      marginLeft: 8,
  },
  communitiesList: {
      padding: 16,
  },
  communityCard: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  communityName: {
      fontSize: 16,
      fontWeight: '600',
      marginRight: 4,
  },
  description: {
      fontSize: 14,
      color: '#666',
      marginTop: 8,
      marginBottom: 12,
  },
  verifiedIcon: {
      marginLeft: 4,
  },
  memberCount: {
      fontSize: 12,
      color: '#666',
      marginTop: 8,
  },
  joinButton: {
      backgroundColor: '#2196F3',
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 80,
  },
  joinButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
  },
  emptyState: {
      padding: 32,
      alignItems: 'center',
  },
  emptyStateText: {
      color: '#666',
      textAlign: 'center',
  },
});