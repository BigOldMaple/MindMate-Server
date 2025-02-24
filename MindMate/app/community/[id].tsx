import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { communityApi, Community } from '@/server/services/communityApi';

export default function CommunityDetailsScreen() {
  const { id } = useLocalSearchParams();
  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('about');
  const router = useRouter();

  useEffect(() => {
    fetchCommunityDetails();
  }, [id]);

  const fetchCommunityDetails = async () => {
    try {
      setIsLoading(true);
      const data = await communityApi.getCommunityDetails(id as string);
      setCommunity(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinCommunity = async () => {
    try {
      await communityApi.joinCommunity(id as string);
      await fetchCommunityDetails();
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

  if (error || !community) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Community not found'}</Text>
        <Pressable style={styles.retryButton} onPress={fetchCommunityDetails}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.communityName}>{community.name}</Text>
            <View style={styles.headerInfo}>
              <Text style={styles.memberCount}>
                {community.memberCount} {community.memberCount === 1 ? 'Member' : 'Members'}
              </Text>
              {community.type === 'professional' && (
                <View style={styles.verifiedBadge}>
                  <FontAwesome name="check-circle" size={12} color="#2196F3" />
                  <Text style={styles.verifiedText}>Professional</Text>
                </View>
              )}
            </View>
          </View>
          {!community.isUserMember && (
            <Pressable style={styles.joinButton} onPress={handleJoinCommunity}>
              <Text style={styles.joinButtonText}>Join</Text>
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'about' && styles.activeTab]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>
              About
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'members' && styles.activeTab]}
            onPress={() => setActiveTab('members')}
          >
            <Text style={[styles.tabText, activeTab === 'members' && styles.activeTabText]}>
              Members
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'support' && styles.activeTab]}
            onPress={() => setActiveTab('support')}
          >
            <Text style={[styles.tabText, activeTab === 'support' && styles.activeTabText]}>
              Support
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content}>
          {activeTab === 'about' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{community.description}</Text>
              
              <View style={styles.adminSection}>
                <Text style={styles.sectionTitle}>Community Admin</Text>
                {community.creatorDetails && (
                  <View style={styles.adminCard}>
                    <View style={styles.adminInfo}>
                      <Text style={styles.adminName}>{community.creatorDetails.profile.name}</Text>
                      <Text style={styles.adminUsername}>@{community.creatorDetails.username}</Text>
                      {community.creatorDetails.profile.isVerifiedProfessional && (
                        <View style={styles.verifiedBadge}>
                          <FontAwesome name="check-circle" size={12} color="#2196F3" />
                          <Text style={styles.verifiedText}>Professional</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {activeTab === 'members' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Members</Text>
              {community.members.map((member) => (
                member.user && (
                  <View key={member.userId} style={styles.memberCard}>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.user.profile.name}</Text>
                      <Text style={styles.memberUsername}>@{member.user.username}</Text>
                    </View>
                    <View style={styles.memberRole}>
                      <Text style={styles.roleText}>{member.role}</Text>
                    </View>
                  </View>
                )
              ))}
            </View>
          )}

          {activeTab === 'support' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Support Requests</Text>
              <View style={styles.comingSoon}>
                <Text style={styles.comingSoonText}>Support features coming soon!</Text>
              </View>
            </View>
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
  header: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flex: 1,
  },
  communityName: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  memberCount: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: '#2196F3',
    marginLeft: 4,
  },
  joinButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  joinButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
  },
  adminSection: {
    marginTop: 16,
  },
  adminCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '600',
  },
  adminUsername: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  memberCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
  },
  memberUsername: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  memberRole: {
    backgroundColor: '#F5F6FA',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: '#666',
  },
  comingSoon: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  comingSoonText: {
    color: '#666',
    fontSize: 16,
  },
});