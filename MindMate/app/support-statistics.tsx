// MindMate/app/support-statistics.tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { mentalHealthApi } from '@/services/mentalHealthApi';

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
}

export default function SupportStatisticsScreen() {
  const [isLoading, setIsLoading] = useState(true);
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
      
      // This would be an actual API call in a real implementation
      // For now, we'll use mock data
      // const data = await mentalHealthApi.getSupportStats();
      
      // Mock data for demonstration
      const mockData: SupportStats = {
        providedSupport: {
          total: 12,
          buddyTier: 8,
          communityTier: 3,
          globalTier: 1,
          lastProvidedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        },
        receivedSupport: {
          total: 5,
          buddyTier: 4,
          communityTier: 1,
          globalTier: 0,
          lastReceivedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        supportImpact: 78
      };
      
      // Simulate loading delay
      setTimeout(() => {
        setStats(mockData);
        setIsLoading(false);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to fetch support statistics:', error);
      setIsLoading(false);
    }
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

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Support Statistics',
        headerShown: true
      }} />
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Loading support statistics...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView}>
            {/* Impact Score Card */}
            <View style={styles.impactCard}>
              <Text style={styles.impactTitle}>Your Support Impact</Text>
              <View style={styles.impactScoreContainer}>
                <View style={styles.impactScore}>
                  <Text style={styles.impactScoreText}>{stats.supportImpact}</Text>
                </View>
              </View>
              <Text style={styles.impactDescription}>
                Your support helps build a stronger mental health community
              </Text>
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
  impactDescription: {
    fontSize: 14,
    color: 'white',
    textAlign: 'center',
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