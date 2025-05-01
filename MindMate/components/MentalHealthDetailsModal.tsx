import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router } from 'expo-router';

interface ReasoningData {
  sleepQuality?: 'poor' | 'fair' | 'good';
  sleepHours?: number;
  activityLevel?: 'low' | 'moderate' | 'high';
  checkInMood?: number;
  stepsPerDay?: number;
  recentExerciseMinutes?: number;
  significantChanges?: string[];
  [key: string]: any;
}

interface MentalHealthDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  timestamp: string;
  status: 'stable' | 'declining' | 'critical';
  confidenceScore: number;
  reasoningData: ReasoningData;
  analysisType?: string;
  assessmentId?: string; // Added assessment ID to support navigation to analyzed data
}

export default function MentalHealthDetailsModal({
  visible,
  onClose,
  timestamp,
  status,
  confidenceScore,
  reasoningData,
  analysisType,
  assessmentId
}: MentalHealthDetailsModalProps) {
  // Get color based on status
  const getStatusColor = () => {
    switch(status) {
      case 'stable': return '#4CAF50'; // Green
      case 'declining': return '#FFA726'; // Orange
      case 'critical': return '#F44336'; // Red
      default: return '#2196F3'; // Blue default
    }
  };

  const statusColor = getStatusColor();
  
  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  const formattedDate = formatFullDate(timestamp);
  
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={[styles.modalTitle, { color: statusColor }]}>
            Mental Health Assessment
          </Text>
          
          <Text style={styles.dateText}>{formattedDate}</Text>
          
          <ScrollView style={styles.scrollView}>
            <View style={[styles.statusContainer, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.toUpperCase()}
              </Text>
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>Confidence:</Text>
                <Text style={[styles.confidenceValue, { color: statusColor }]}>
                  {Math.round(confidenceScore * 100)}%
                </Text>
              </View>
            </View>
            
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>ASSESSMENT DETAILS</Text>
              <View style={styles.metricsContainer}>
                {reasoningData.sleepQuality && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Sleep Quality:</Text>
                    <Text style={styles.metricValue}>{reasoningData.sleepQuality}</Text>
                  </View>
                )}
                
                {reasoningData.sleepHours && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Sleep Hours:</Text>
                    <Text style={styles.metricValue}>{reasoningData.sleepHours.toFixed(1)} hrs/night</Text>
                  </View>
                )}
                
                {reasoningData.activityLevel && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Activity Level:</Text>
                    <Text style={styles.metricValue}>{reasoningData.activityLevel}</Text>
                  </View>
                )}
                
                {reasoningData.checkInMood && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Mood Score:</Text>
                    <Text style={styles.metricValue}>{reasoningData.checkInMood.toFixed(1)}/5</Text>
                  </View>
                )}
                
                {reasoningData.stepsPerDay && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Daily Steps:</Text>
                    <Text style={styles.metricValue}>{reasoningData.stepsPerDay.toLocaleString()} steps</Text>
                  </View>
                )}
                
                {reasoningData.recentExerciseMinutes && (
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Exercise:</Text>
                    <Text style={styles.metricValue}>{reasoningData.recentExerciseMinutes} mins</Text>
                  </View>
                )}
              </View>
            </View>
            
            {reasoningData.significantChanges && reasoningData.significantChanges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>SIGNIFICANT CHANGES</Text>
                {reasoningData.significantChanges.map((change, index) => (
                  <Text key={index} style={styles.changeText}>• {change}</Text>
                ))}
              </View>
            )}
            
            {analysisType && (
              <View style={styles.analysisTypeContainer}>
                <Text style={styles.analysisTypeLabel}>Analysis Type:</Text>
                <Text style={styles.analysisTypeValue}>
                  {analysisType === 'recent' ? 'Recent Analysis' : 
                   analysisType === 'baseline' ? 'Baseline Assessment' : 
                   'Standard Assessment'}
                </Text>
              </View>
            )}
            
            <TouchableOpacity 
              style={styles.viewDataButton}
              onPress={() => {
                onClose();
                router.push({
                  pathname: '/home/analyzed-data',
                  params: { 
                    source: analysisType || 'standard',
                    assessmentId: assessmentId
                  }
                });
              }}
            >
              <FontAwesome name="database" size={16} color="#FFFFFF" />
              <Text style={styles.viewDataButtonText}>View Analyzed Data</Text>
            </TouchableOpacity>
          </ScrollView>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

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
    marginBottom: 5,
  },
  dateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    color: '#666',
  },
  statusContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  confidenceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 5,
  },
  confidenceValue: {
    fontSize: 18,
    fontWeight: 'bold',
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
    width: 120,
    fontSize: 15,
    fontWeight: '500',
    color: '#555',
  },
  metricValue: {
    flex: 1,
    fontSize: 15,
  },
  changeText: {
    fontSize: 15,
    marginBottom: 5,
    paddingLeft: 5,
    lineHeight: 20,
  },
  analysisTypeContainer: {
    flexDirection: 'row',
    marginTop: 10,
    marginBottom: 10,
    justifyContent: 'center',
  },
  analysisTypeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 5,
  },
  analysisTypeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2196F3',
  },
  viewDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1976D2',
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
    gap: 8,
  },
  viewDataButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    marginTop: 10,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
});