import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

interface BaselineMetrics {
  sleepQuality?: string;
  sleepHours?: number;
  activityLevel?: string;
  averageStepsPerDay?: number;
  averageMoodScore?: number;
  exerciseMinutesPerWeek?: number;
}

interface DataPoints {
  totalDays: number;
  daysWithSleepData: number;
  daysWithActivityData: number;
  checkInsCount: number;
}

interface BaselineResultModalProps {
  visible: boolean;
  onClose: () => void;
  baselineMetrics?: BaselineMetrics;
  dataPoints?: DataPoints;
  significantPatterns?: string[];
  confidenceScore?: number;
}

const BaselineResultModal: React.FC<BaselineResultModalProps> = ({
  visible,
  onClose,
  baselineMetrics,
  dataPoints,
  significantPatterns,
  confidenceScore
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Baseline Established</Text>
          
          <ScrollView style={styles.scrollView}>
            <Text style={styles.introText}>
              Your mental health baseline has been successfully established using {dataPoints?.totalDays || 0} days of data.
            </Text>
            
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>BASELINE METRICS</Text>
              <View style={styles.metricsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Sleep:</Text>
                  <Text style={styles.metricValue}>
                    {baselineMetrics?.sleepQuality || 'Not available'} quality, {baselineMetrics?.sleepHours?.toFixed(1) || 'N/A'} hrs/night
                  </Text>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Activity:</Text>
                  <Text style={styles.metricValue}>
                    {baselineMetrics?.activityLevel || 'Not available'}, {baselineMetrics?.averageStepsPerDay?.toLocaleString() || 'N/A'} steps/day
                  </Text>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Mood:</Text>
                  <Text style={styles.metricValue}>
                    {baselineMetrics?.averageMoodScore?.toFixed(1) || 'Not available'}/5
                  </Text>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Exercise:</Text>
                  <Text style={styles.metricValue}>
                    {baselineMetrics?.exerciseMinutesPerWeek?.toFixed(0) || 'Not available'} mins/week
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>DATA COMPLETENESS</Text>
              <View style={styles.metricsContainer}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Sleep data:</Text>
                  <Text style={styles.metricValue}>
                    {dataPoints?.daysWithSleepData || 0}/{dataPoints?.totalDays || 0} days 
                    ({((dataPoints?.daysWithSleepData || 0) / (dataPoints?.totalDays || 1) * 100).toFixed(0)}%)
                  </Text>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Activity data:</Text>
                  <Text style={styles.metricValue}>
                    {dataPoints?.daysWithActivityData || 0}/{dataPoints?.totalDays || 0} days 
                    ({((dataPoints?.daysWithActivityData || 0) / (dataPoints?.totalDays || 1) * 100).toFixed(0)}%)
                  </Text>
                </View>
                
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Check-ins:</Text>
                  <Text style={styles.metricValue}>{dataPoints?.checkInsCount || 0} total</Text>
                </View>
              </View>
            </View>
            
            {significantPatterns && significantPatterns.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>SIGNIFICANT PATTERNS</Text>
                {significantPatterns.map((pattern, index) => (
                  <Text key={index} style={styles.patternText}>• {pattern}</Text>
                ))}
              </View>
            )}
            
            <View style={styles.confidenceSection}>
              <Text style={styles.confidenceLabel}>Confidence score:</Text>
              <Text style={styles.confidenceValue}>{confidenceScore ? (confidenceScore * 100).toFixed(0) : 0}%</Text>
            </View>
          </ScrollView>
          
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
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
    color: '#1976D2',
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
  metricsContainer: {
    backgroundColor: '#F5F9FF',
    borderRadius: 8,
    padding: 10,
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: 6,
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
    color: '#1976D2',
  },
  button: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    marginTop: 15,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});

export default BaselineResultModal;