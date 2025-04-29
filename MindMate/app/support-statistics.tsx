// MindMate/app/support-statistics.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator, Alert, RefreshControl, Pressable } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { mentalHealthApi } from '@/services/mentalHealthApi';

interface SupportHistoryEntry {
  type: 'provided' | 'received';
  tier: 'buddy' | 'community' | 'global';
  timestamp: string;
  userId: string;
  assessmentId: string;
}

interface SupportStats {
  providedSupport: {
    total: number;
    buddyTier: number;
    communityTier: number;
    globalTier: number;
    lastProvidedAt: string | null;
  };
  receivedSupport: {
    total: number;
    buddyTier: number;
    communityTier: number; 
    globalTier: number;
    lastReceivedAt: string | null;
  };
  supportImpact: number; // 0-100 score
  recentHistory?: SupportHistoryEntry[];
}

export default function SupportStatisticsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [stats, setStats] = useState<SupportStats>({
    providedSupport: {
      total: 0,
      buddyTier: 0,
      communityTier: 0,
      globalTier: 0,
      lastProvidedAt: null
    },
    receivedSupport: {
      total: 0,
      buddyTier: 0,
      communityTier: 0,
      globalTier: 0,
      lastReceivedAt: null
    },
    supportImpact: 0
  });

  useEffect(() => {
    fetchSupportStats();
  }, []);

  const fetchSupportStats = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      
      // Call the real API instead of using mock data
      const data = await mentalHealthApi.getSupportStatistics();
      
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch support statistics:', error);
      setHasError(true);
      if (!refreshing) {
        Alert.alert('Error', 'Failed to load support statistics. Please try again later.');
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSupportStats();
  };

  // Format date to "X days ago" or date string
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  // Get appropriate tier name display text
  const getTierDisplayName = (tier: string): string => {
    switch (tier) {
      case 'buddy':
        return 'Buddy';
      case 'community':
        return 'Community';
      case 'global':
        return 'Global';
      default:
        return tier;
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Support Statistics</Text>
        </View>
        
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading support statistics...</Text>
          </View>
        ) : hasError && !stats.providedSupport.total && !stats.receivedSupport.total ? (
          <View style={styles.errorContainer}>
            <FontAwesome name="exclamation-circle" size={64} color="#F44336" />
            <Text style={styles.errorText}>Failed to load statistics</Text>
            <Pressable style={styles.refreshButton} onPress={fetchSupportStats}>
              <Text style={styles.refreshButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2196F3']}
              />
            }
          >
            {/* Impact Score Card */}
            <View style={styles.impactCard}>
              <Text style={styles.impactTitle}>Your Support Impact</Text>
              <View style={styles.impactScoreContainer}>
                <View style={styles.impactScore}>
                  <Text style={styles.impactScoreText}>{stats.supportImpact}</Text>
                </View>
                <View style={styles.ratingContainer}>
                  <Text style={styles.ratingLabel}>
                    {stats.supportImpact < 30 ? 'Developing' : 
                     stats.supportImpact < 60 ? 'Established' : 'Outstanding'}
                  </Text>
                </View>
              </View>
              
              <Text style={styles.impactDescription}>
                This score measures your overall contribution to the MindMate community, combining support given ({stats.providedSupport.total}) and received ({stats.receivedSupport.total}).
              </Text>
              
              {/* Expandable explanation panel */}
              <Pressable 
                style={styles.explanationButton} 
                onPress={() => setShowExplanation(!showExplanation)}
              >
                <Text style={styles.explanationButtonText}>
                  {showExplanation ? "Hide details" : "What does this mean?"}
                </Text>
                <FontAwesome 
                  name={showExplanation ? "chevron-up" : "chevron-down"} 
                  size={12} 
                  color="white" 
                />
              </Pressable>
              
              {showExplanation && (
                <View style={styles.explanationPanel}>
                  <Text style={styles.explanationText}>
                    <Text style={{fontWeight: 'bold'}}>How it's calculated:</Text>{'\n'}
                    • 60% based on support you've provided{'\n'}
                    • 40% based on support you've received{'\n'}
                    • Higher scores reflect more community engagement{'\n\n'}
                    <Text style={{fontWeight: 'bold'}}>Score ranges:</Text>{'\n'}
                    • 0-30: Developing - Just getting started{'\n'}
                    • 31-60: Established - Regular community member{'\n'}
                    • 61-100: Outstanding - Community pillar{'\n\n'}
                    <Text style={{fontWeight: 'bold'}}>How to improve:</Text>{'\n'}
                    • Provide support to your buddy peers when requested{'\n'}
                    • Respond to community and global support requests{'\n'}
                    • Reach out for support when you need it
                  </Text>
                </View>
              )}
            </View>
            
            {/* Support Provided Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Support Provided</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.providedSupport.total}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.providedSupport.buddyTier}</Text>
                  <Text style={styles.statLabel}>To Buddies</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.providedSupport.communityTier}</Text>
                  <Text style={styles.statLabel}>To Community</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last Support Provided</Text>
                <Text style={styles.detailValue}>
                  {formatTimeAgo(stats.providedSupport.lastProvidedAt)}
                </Text>
              </View>
            </View>
            
            {/* Support Received Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Support Received</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.receivedSupport.total}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.receivedSupport.buddyTier}</Text>
                  <Text style={styles.statLabel}>From Buddies</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats.receivedSupport.communityTier + stats.receivedSupport.globalTier}</Text>
                  <Text style={styles.statLabel}>From Others</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Last Support Received</Text>
                <Text style={styles.detailValue}>
                  {formatTimeAgo(stats.receivedSupport.lastReceivedAt)}
                </Text>
              </View>
            </View>
            
            {/* Recent Support History */}
            {stats.recentHistory && stats.recentHistory.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Recent Support Activity</Text>
                {stats.recentHistory.map((entry, index) => (
                  <View key={index} style={styles.historyItem}>
                    <View style={styles.historyIconContainer}>
                      <FontAwesome 
                        name={entry.type === 'provided' ? 'hand-o-right' : 'hand-o-left'} 
                        size={20} 
                        color={entry.type === 'provided' ? '#2196F3' : '#4CAF50'} 
                      />
                    </View>
                    <View style={styles.historyContent}>
                      <Text style={styles.historyTitle}>
                        {entry.type === 'provided' ? 'Provided' : 'Received'} {getTierDisplayName(entry.tier)} support
                      </Text>
                      <Text style={styles.historyTime}>{formatTimeAgo(entry.timestamp)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            
            {/* Support Benefits Info */}
            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <FontAwesome name="info-circle" size={20} color="#2196F3" />
                <Text style={styles.infoTitle}>Benefits of Peer Support</Text>
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoText}>
                  • Reduces feelings of isolation{'\n'}
                  • Provides different perspectives{'\n'}
                  • Builds a sense of community{'\n'}
                  • Offers practical coping strategies{'\n'}
                  • Creates mutual encouragement
                </Text>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  // Custom header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 10,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  // Rest of the styles
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#666',
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
  scrollView: {
    flex: 1,
    padding: 16,
  },
  impactCard: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  impactScoreContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  impactScore: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  impactScoreText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  ratingContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
  },
  ratingLabel: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  impactDescription: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
  },
  explanationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 16,
  },
  explanationButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
  },
  explanationPanel: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
  },
  explanationText: {
    color: '#333',
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  historyIconContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoContent: {
    paddingLeft: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#666',
  },
});