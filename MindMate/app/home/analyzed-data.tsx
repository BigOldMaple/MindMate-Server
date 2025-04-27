import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { getApiUrl } from '@/services/apiConfig';
import * as SecureStore from 'expo-secure-store';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AnalyzedDataScreen() {
  const params = useLocalSearchParams();
  const source = params.source as string;
  const dataCount = params.dataCount ? JSON.parse(params.dataCount as string) : {};
  
  const [isLoading, setIsLoading] = useState(true);
  const [healthData, setHealthData] = useState<any[]>([]);
  const [checkIns, setCheckIns] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'health' | 'checkIns'>('health');

  useEffect(() => {
    fetchAnalyzedData();
  }, []);

  const fetchAnalyzedData = async () => {
    try {
      setIsLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      if (!token) {
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      // Get the endpoint based on the source
      const endpoint = source === 'baseline' 
        ? `${getApiUrl()}/mental-health/baseline/analyzed-data`
        : `${getApiUrl()}/mental-health/recent/analyzed-data`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analyzed data');
      }

      const data = await response.json();
      setHealthData(data.healthData || []);
      setCheckIns(data.checkIns || []);
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching analyzed data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderHealthData = () => {
    if (healthData.length === 0) {
      return <Text style={styles.noDataText}>No health data available</Text>;
    }

    return (
      <ScrollView style={styles.dataContainer}>
        {healthData.map((item, index) => (
          <View key={index} style={styles.dataItem}>
            <Text style={styles.dateText}>{formatDate(item.date)}</Text>
            
            {item.sleep && (
              <View style={styles.metricContainer}>
                <Text style={styles.metricHeader}>Sleep</Text>
                <Text>Duration: {(item.sleep.durationInSeconds / 3600).toFixed(1)} hours</Text>
                <Text>Quality: {item.sleep.quality || 'Not recorded'}</Text>
                {item.sleep.startTime && item.sleep.endTime && (
                  <Text>
                    Time: {new Date(item.sleep.startTime).toLocaleTimeString()} - {new Date(item.sleep.endTime).toLocaleTimeString()}
                  </Text>
                )}
              </View>
            )}
            
            {item.summary && (
              <View style={styles.metricContainer}>
                <Text style={styles.metricHeader}>Activity</Text>
                {item.summary.totalSteps > 0 && (
                  <Text>Steps: {item.summary.totalSteps.toLocaleString()}</Text>
                )}
                {item.summary.totalExerciseSeconds > 0 && (
                  <Text>Exercise: {Math.round(item.summary.totalExerciseSeconds / 60)} minutes</Text>
                )}
              </View>
            )}
            
            {item.exercises && item.exercises.length > 0 && (
              <View style={styles.metricContainer}>
                <Text style={styles.metricHeader}>Exercise Sessions</Text>
                {item.exercises.map((exercise: any, exIndex: number) => (
                  <View key={exIndex} style={styles.exerciseItem}>
                    <Text>Type: {exercise.type}</Text>
                    <Text>Duration: {Math.round(exercise.durationInSeconds / 60)} minutes</Text>
                    {exercise.calories && <Text>Calories: {exercise.calories}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderCheckIns = () => {
    if (checkIns.length === 0) {
      return <Text style={styles.noDataText}>No check-in data available</Text>;
    }

    return (
      <ScrollView style={styles.dataContainer}>
        {checkIns.map((checkIn, index) => (
          <View key={index} style={styles.dataItem}>
            <Text style={styles.dateText}>{formatDate(checkIn.timestamp)}</Text>
            
            <View style={styles.metricContainer}>
              <Text style={styles.metricHeader}>Mood</Text>
              <Text>Score: {checkIn.mood.score}/5 ({checkIn.mood.label})</Text>
              {checkIn.notes && (
                <View style={styles.notesContainer}>
                  <Text style={styles.notesHeader}>Notes:</Text>
                  <Text style={styles.notesText}>{checkIn.notes}</Text>
                </View>
              )}
            </View>
            
            {checkIn.activities && checkIn.activities.length > 0 && (
              <View style={styles.metricContainer}>
                <Text style={styles.metricHeader}>Activities</Text>
                {checkIn.activities.map((activity: any, actIndex: number) => (
                  <Text key={actIndex}>
                    {activity.type}: {activity.level}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Analyzed Data' }} />
      
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Data Analyzed for {source === 'baseline' ? 'Baseline' : 'Recent'} Assessment
          </Text>
          <Text style={styles.subtitle}>
            {source === 'baseline' 
              ? `Based on ${dataCount.healthRecords || 0} health records and ${dataCount.checkIns || 0} check-ins`
              : 'Most recent health and check-in data'}
          </Text>
        </View>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'health' && styles.activeTab]}
            onPress={() => setActiveTab('health')}
          >
            <FontAwesome name="heartbeat" size={16} color={activeTab === 'health' ? '#1976D2' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'health' && styles.activeTabText]}>
              Health Data ({healthData.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'checkIns' && styles.activeTab]}
            onPress={() => setActiveTab('checkIns')}
          >
            <FontAwesome name="comment" size={16} color={activeTab === 'checkIns' ? '#1976D2' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'checkIns' && styles.activeTabText]}>
              Check-Ins ({checkIns.length})
            </Text>
          </TouchableOpacity>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#1976D2" />
            <Text style={styles.loadingText}>Loading analyzed data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchAnalyzedData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contentContainer}>
            {activeTab === 'health' ? renderHealthData() : renderCheckIns()}
          </View>
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
  header: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1976D2',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#1976D2',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  dataContainer: {
    flex: 1,
  },
  dataItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  metricContainer: {
    marginTop: 6,
    padding: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 6,
  },
  metricHeader: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1976D2',
  },
  exerciseItem: {
    marginTop: 4,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  notesContainer: {
    marginTop: 4,
  },
  notesHeader: {
    fontSize: 14,
    fontWeight: '500',
  },
  notesText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#555',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
});