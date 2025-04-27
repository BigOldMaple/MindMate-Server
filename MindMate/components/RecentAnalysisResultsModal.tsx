import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';

interface BaselineComparison {
  sleepChange?: string;
  activityChange?: string;
  moodChange?: string;
}

interface RecentMetrics {
  sleepQuality?: string;
  sleepHours?: number;
  activityLevel?: string;
  stepsPerDay?: number;
  checkInMood?: number;
  exerciseMinutes?: number;
}

interface RecentAnalysisResultsModalProps {
  visible: boolean;
  onClose: () => void;
  status?: string;
  confidenceScore?: number;
  needsSupport?: boolean;
  baselineComparison?: BaselineComparison;
  metrics?: RecentMetrics;
  significantChanges?: string[];
  rawData?: {
    healthData?: any[];
    checkIns?: any[];
  };
}

const RecentAnalysisResultsModal: React.FC<RecentAnalysisResultsModalProps> = ({
  visible,
  onClose,
  status,
  confidenceScore,
  needsSupport,
  baselineComparison,
  metrics,
  significantChanges,
  rawData
}) => {
  
  const navigateToAnalyzedData = () => {
    if (rawData) {
      router.push({
        pathname: '/home/analyzed-data',
        params: { 
          source: 'recent',
          dataCount: JSON.stringify({
            healthRecords: rawData.healthData?.length || 0,
            checkIns: rawData.checkIns?.length || 0
          })
        }
      });
    }
    onClose(); // Close the modal when navigating
  };

  // Determine status color
  const getStatusColor = () => {
    switch(status?.toLowerCase()) {
      case 'stable': return '#4CAF50'; // Green
      case 'declining': return '#FFC107'; // Yellow/amber
      case 'critical': return '#F44336'; // Red
      default: return '#2196F3'; // Blue (default)
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Recent Analysis Results</Text>
          
          <ScrollView style={styles.scrollView}>
            <Text style={styles.introText}>
              Your recent mental health data (past 3 days) has been analyzed with recency weighting.
            </Text>
            
            {/* Status Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>MENTAL HEALTH STATUS</Text>
              <View style={[styles.statusContainer, { backgroundColor: `${getStatusColor()}20` }]}>
                <Text style={[styles.statusText, { color: getStatusColor() }]}>
                  {status || 'Not available'}
                </Text>
                <Text style={styles.statusDetails}>
                  {needsSupport 
                    ? 'Our analysis suggests you might benefit from connecting with your support network.' 
                    : 'Our analysis suggests your mental health is currently in a manageable state.'}
                </Text>
              </View>
            </View>
            
            {/* Metrics Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>RECENT METRICS</Text>
              <View style={styles.metricsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Sleep:</Text>
                  <View style={styles.metricValueContainer}>
                    {metrics?.sleepQuality ? (
                      <Text style={styles.metricValue}>{metrics.sleepQuality} quality</Text>
                    ) : null}
                    {metrics?.sleepHours ? (
                      <Text style={styles.metricValue}>{metrics.sleepHours.toFixed(1)} hrs/night</Text>
                    ) : (
                      <Text style={styles.missingMetric}>No sleep data available</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Activity:</Text>
                  <View style={styles.metricValueContainer}>
                    {metrics?.activityLevel ? (
                      <Text style={styles.metricValue}>{metrics.activityLevel} level</Text>
                    ) : null}
                    {metrics?.stepsPerDay ? (
                      <Text style={styles.metricValue}>{metrics.stepsPerDay.toLocaleString()} steps/day</Text>
                    ) : (
                      <Text style={styles.missingMetric}>No activity data available</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Mood:</Text>
                  {metrics?.checkInMood ? (
                    <Text style={styles.metricValue}>{metrics.checkInMood.toFixed(1)}/5</Text>
                  ) : (
                    <Text style={styles.missingMetric}>No mood data available</Text>
                  )}
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Exercise:</Text>
                  {metrics?.exerciseMinutes ? (
                    <Text style={styles.metricValue}>{metrics.exerciseMinutes.toFixed(0)} mins/3 days</Text>
                  ) : (
                    <Text style={styles.missingMetric}>No exercise data available</Text>
                  )}
                </View>
              </View>
            </View>
            
            {/* Baseline Comparison Section */}
            {baselineComparison && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>BASELINE COMPARISON</Text>
                <View style={styles.metricsContainer}>
                  {baselineComparison.sleepChange && (
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Sleep:</Text>
                      <Text style={styles.metricValue}>{baselineComparison.sleepChange}</Text>
                    </View>
                  )}
                  
                  {baselineComparison.activityChange && (
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Activity:</Text>
                      <Text style={styles.metricValue}>{baselineComparison.activityChange}</Text>
                    </View>
                  )}
                  
                  {baselineComparison.moodChange && (
                    <View style={styles.metricRow}>
                      <Text style={styles.metricLabel}>Mood:</Text>
                      <Text style={styles.metricValue}>{baselineComparison.moodChange}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            
            {/* Significant Changes Section */}
            {significantChanges && significantChanges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>SIGNIFICANT CHANGES</Text>
                {significantChanges.map((change, index) => (
                  <Text key={index} style={styles.patternText}>• {change}</Text>
                ))}
              </View>
            )}
            
            <View style={styles.confidenceSection}>
              <Text style={styles.confidenceLabel}>Confidence score:</Text>
              <Text style={styles.confidenceValue}>{confidenceScore ? (confidenceScore * 100).toFixed(0) : 0}%</Text>
            </View>
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.dataButton} 
              onPress={navigateToAnalyzedData}
            >
              <Text style={styles.dataButtonText}>View Analyzed Data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollView: {
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#43A047', // Match analyze button color
  },
  introText: {
    fontSize: 16,
    marginBottom: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  section: {
    marginBottom: 15,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  statusContainer: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statusDetails: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  metricsContainer: {
    backgroundColor: '#F5F9FF',
    borderRadius: 8,
    padding: 10,
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  metricLabel: {
    width: 100,
    fontSize: 15,
    fontWeight: '500',
    color: '#555',
  },
  metricValue: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  metricValueContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  missingMetric: {
    flex: 1,
    fontSize: 14,
    fontStyle: 'italic',
    color: '#888',
  },
  patternText: {
    fontSize: 15,
    marginBottom: 5,
    paddingLeft: 5,
    lineHeight: 20,
  },
  confidenceSection: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 5,
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
    color: '#43A047',
  },
  buttonContainer: {
    flexDirection: 'column',
    marginTop: 15,
    gap: 10,
  },
  dataButton: {
    backgroundColor: '#F5F9FF',
    borderWidth: 1,
    borderColor: '#43A047',
    borderRadius: 10,
    padding: 12,
  },
  dataButtonText: {
    color: '#43A047',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#43A047',
    borderRadius: 10,
    padding: 12,
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default RecentAnalysisResultsModal;