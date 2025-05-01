// app/(tabs)/profile.tsx
import { StyleSheet, ScrollView, Pressable, View as DefaultView, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, UserProfile, EmergencyContact } from '../../services/profileApi';
import { mentalHealthApi } from '../../services/mentalHealthApi';
import MentalHealthHistoryCard from '../../components/MentalHealthHistoryCard';
import MentalHealthDetailsModal from '../../components/MentalHealthDetailsModal';
import React from 'react';

interface EditModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (value: string) => Promise<void>;
    value: string;
    label: string;
    placeholder: string;
}

function EditModal({ visible, onClose, onSave, value, label, placeholder }: EditModalProps) {
    const [newValue, setNewValue] = useState(value);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        try {
            setIsLoading(true);
            await onSave(newValue);
            onClose();
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save changes');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Edit {label}</Text>
                    <TextInput
                        style={styles.modalInput}
                        value={newValue}
                        onChangeText={setNewValue}
                        placeholder={placeholder}
                    />
                    <View style={styles.modalButtons}>
                        <Pressable style={styles.modalButton} onPress={onClose}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable 
                            style={[styles.modalButton, styles.modalSaveButton]}
                            onPress={handleSave}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={[styles.modalButtonText, styles.modalSaveButtonText]}>
                                    Save
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

interface EmergencyContactModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (contact: EmergencyContact) => Promise<void>;
    currentContact?: EmergencyContact;
}

function EmergencyContactModal({ visible, onClose, onSave, currentContact }: EmergencyContactModalProps) {
    const [contact, setContact] = useState<EmergencyContact>(currentContact || {
        name: '',
        relationship: '',
        phone: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = async () => {
        try {
            setIsLoading(true);
            await onSave(contact);
            onClose();
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save emergency contact');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Emergency Contact</Text>
                    
                    <TextInput
                        style={styles.modalInput}
                        value={contact.name}
                        onChangeText={(value) => setContact({ ...contact, name: value })}
                        placeholder="Contact Name"
                    />
                    
                    <TextInput
                        style={styles.modalInput}
                        value={contact.relationship}
                        onChangeText={(value) => setContact({ ...contact, relationship: value })}
                        placeholder="Relationship"
                    />
                    
                    <TextInput
                        style={styles.modalInput}
                        value={contact.phone}
                        onChangeText={(value) => setContact({ ...contact, phone: value })}
                        placeholder="Phone Number"
                        keyboardType="phone-pad"
                    />

                    <View style={styles.modalButtons}>
                        <Pressable style={styles.modalButton} onPress={onClose}>
                            <Text style={styles.modalButtonText}>Cancel</Text>
                        </Pressable>
                        <Pressable 
                            style={[styles.modalButton, styles.modalSaveButton]}
                            onPress={handleSave}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={[styles.modalButtonText, styles.modalSaveButtonText]}>
                                    Save
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// Helper function to group assessments by month and day
function groupAssessmentsByMonth(assessments: any[]) {
  // First group by month
  const byMonth: Record<string, any[]> = {};
  
  assessments.forEach(assessment => {
    const date = new Date(assessment.timestamp);
    const monthYear = date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    if (!byMonth[monthYear]) {
      byMonth[monthYear] = [];
    }
    
    byMonth[monthYear].push(assessment);
  });
  
  // Then sort each month's assessments by day (descending order)
  Object.keys(byMonth).forEach(month => {
    // Sort assessments by day, with most recent first
    byMonth[month].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      
      // If different days, sort by day
      if (dateA.getDate() !== dateB.getDate()) {
        return dateB.getDate() - dateA.getDate();
      }
      
      // If same day, sort by time (most recent first)
      return dateB.getTime() - dateA.getTime();
    });
  });
  
  return byMonth;
}

export default function ProfileScreen() {
    const [activeTab, setActiveTab] = useState('account');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [editingField, setEditingField] = useState<string | null>(null);
    const { user } = useAuth();

    // Mental Health History state
    const [mentalHealthHistory, setMentalHealthHistory] = useState<any[]>([]);
    const [baselineHistory, setBaselineHistory] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingBaselines, setIsLoadingBaselines] = useState(false);
    const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [showAllBaselines, setShowAllBaselines] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchMentalHealthHistory();
        }
    }, [activeTab]);

    const fetchProfile = async () => {
        try {
            setIsLoading(true);
            const data = await profileApi.getProfile();
            setProfile(data);
        } catch (error) {
            Alert.alert('Error', 'Failed to load profile');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMentalHealthHistory = async () => {
        try {
            setIsLoadingHistory(true);
            setIsLoadingBaselines(true);
            
            // Fetch regular assessments
            const assessments = await mentalHealthApi.getAssessmentHistory(20);
            setMentalHealthHistory(assessments);
            
            // Fetch baseline assessments separately
            const baselines = await mentalHealthApi.getBaselineHistory(5);
            setBaselineHistory(baselines);
        } catch (error) {
            Alert.alert('Error', 'Failed to load mental health history');
        } finally {
            setIsLoadingHistory(false);
            setIsLoadingBaselines(false);
        }
    };

    const handleUpdateField = async (field: string, value: string) => {
        try {
            const updateData: any = { [field]: value };
            const updatedProfile = await profileApi.updateProfile(updateData);
            setProfile(updatedProfile);
        } catch (error) {
            throw error;
        }
    };

    const handleUpdateEmergencyContact = async (contact: EmergencyContact) => {
        try {
            const updatedProfile = await profileApi.updateProfile({
                emergencyContact: contact
            });
            setProfile(updatedProfile);
        } catch (error) {
            throw error;
        }
    };

    const openAssessmentDetails = (assessment: any) => {
        setSelectedAssessment(assessment);
        setDetailsModalVisible(true);
    };
    
    const closeAssessmentDetails = () => {
        setDetailsModalVisible(false);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <DefaultView style={styles.tabContainer}>
                <Pressable
                    style={[styles.tabButton, activeTab === 'account' && styles.activeTabButton]}
                    onPress={() => setActiveTab('account')}
                >
                    <Text style={[styles.tabText, activeTab === 'account' && styles.activeTabText]}>
                        Account Details
                    </Text>
                </Pressable>
                <Pressable
                    style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                        Mental Health History
                    </Text>
                </Pressable>
            </DefaultView>

            <ScrollView style={styles.content}>
                {activeTab === 'account' && profile && (
                    <>
                        <DefaultView style={styles.profilePictureContainer}>
                            <DefaultView style={styles.profilePicture}>
                                <FontAwesome name="user" size={50} color="#666" />
                            </DefaultView>
                            <Pressable style={styles.editPictureButton}>
                                <FontAwesome name="pencil" size={16} color="#2196F3" />
                            </Pressable>
                        </DefaultView>

                        <DefaultView style={styles.section}>
                            <Text style={styles.sectionTitle}>Personal Information</Text>

                            <Pressable 
                                style={styles.infoRow}
                                onPress={() => setEditingField('username')}
                                android_ripple={{ color: 'rgba(33, 150, 243, 0.1)' }}
                            >
                                <DefaultView style={styles.infoContent}>
                                    <DefaultView style={styles.infoLabel}>
                                        <Text style={styles.labelText}>Username</Text>
                                        <Text style={styles.infoText}>{profile.username}</Text>
                                    </DefaultView>
                                    <FontAwesome name="pencil" size={16} color="#2196F3" />
                                </DefaultView>
                            </Pressable>

                            <DefaultView style={styles.infoRow}>
                                <DefaultView style={styles.infoContent}>
                                    <DefaultView style={styles.infoLabel}>
                                        <Text style={styles.labelText}>Email</Text>
                                        <Text style={styles.infoText}>{profile.email}</Text>
                                    </DefaultView>
                                    <View style={styles.iconPlaceholder} />
                                </DefaultView>
                            </DefaultView>

                            <Pressable 
                                style={styles.infoRow}
                                onPress={() => setEditingField('phone')}
                                android_ripple={{ color: 'rgba(33, 150, 243, 0.1)' }}
                            >
                                <DefaultView style={styles.infoContent}>
                                    <DefaultView style={styles.infoLabel}>
                                        <Text style={styles.labelText}>Phone</Text>
                                        <Text style={styles.infoText}>{profile.phone || 'Not set'}</Text>
                                    </DefaultView>
                                    <FontAwesome name="pencil" size={16} color="#2196F3" />
                                </DefaultView>
                            </Pressable>
                        </DefaultView>

                        <DefaultView style={styles.section}>
                            <Text style={styles.sectionTitle}>Emergency Contact</Text>

                            <Pressable 
                                style={styles.infoRow}
                                onPress={() => setEditingField('emergencyContact')}
                                android_ripple={{ color: 'rgba(33, 150, 243, 0.1)' }}
                            >
                                <DefaultView style={styles.infoContent}>
                                    <DefaultView style={styles.infoLabel}>
                                        <Text style={styles.labelText}>Contact Person</Text>
                                        <Text style={styles.infoText}>
                                            {profile.emergencyContact ? 
                                                `${profile.emergencyContact.name} (${profile.emergencyContact.relationship})` : 
                                                'Not set'}
                                        </Text>
                                    </DefaultView>
                                    <FontAwesome name="pencil" size={16} color="#2196F3" />
                                </DefaultView>
                            </Pressable>

                            <DefaultView style={styles.infoRow}>
                                <DefaultView style={styles.infoContent}>
                                    <DefaultView style={styles.infoLabel}>
                                        <Text style={styles.labelText}>Emergency Phone</Text>
                                        <Text style={styles.infoText}>
                                            {profile.emergencyContact?.phone || 'Not set'}
                                        </Text>
                                    </DefaultView>
                                    <View style={styles.iconPlaceholder} />
                                </DefaultView>
                            </DefaultView>
                        </DefaultView>

                        {/* Edit Modals */}
                        <EditModal
                            visible={editingField === 'username'}
                            onClose={() => setEditingField(null)}
                            onSave={(value) => handleUpdateField('username', value)}
                            value={profile.username}
                            label="Username"
                            placeholder="Enter new username"
                        />

                        <EditModal
                            visible={editingField === 'phone'}
                            onClose={() => setEditingField(null)}
                            onSave={(value) => handleUpdateField('phone', value)}
                            value={profile.phone || ''}
                            label="Phone Number"
                            placeholder="Enter phone number"
                        />

                        <EmergencyContactModal
                            visible={editingField === 'emergencyContact'}
                            onClose={() => setEditingField(null)}
                            onSave={handleUpdateEmergencyContact}
                            currentContact={profile.emergencyContact}
                        />
                    </>
                )}

                {/* Mental Health History Tab - UPDATED */}
                {activeTab === 'history' && (
                    <View style={styles.historyContent}>
                        {isLoadingHistory && isLoadingBaselines ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#2196F3" />
                            </View>
                        ) : mentalHealthHistory.length === 0 && baselineHistory.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>
                                    No mental health assessments found. Complete a mental health assessment to see your history.
                                </Text>
                            </View>
                        ) : (
                            <View>
                                {/* Baseline Section */}
                                {baselineHistory.length > 0 && (
                                    <View style={styles.baselineSection}>
                                        <Text style={styles.baselineSectionHeader}>BASELINE</Text>
                                        <Text style={styles.baselineHelperText}>
                                            Your active baseline establishes your normal mental health patterns
                                            and is used as a reference point for all analyses.
                                        </Text>
                                        
                                        {/* Most recent baseline - always shown */}
                                        <View style={styles.currentBaselineCard}>
                                            <Text style={styles.currentBaselineLabel}>Current Active Baseline</Text>
                                            <MentalHealthHistoryCard
                                                date={baselineHistory[0].establishedAt}
                                                status={baselineHistory[0].rawAssessmentData?.mentalHealthStatus || 'stable'}
                                                confidenceScore={baselineHistory[0].confidenceScore}
                                                notes={"Active Mental Health Baseline"}
                                                onPress={() => openAssessmentDetails({
                                                    _id: baselineHistory[0]._id,
                                                    timestamp: baselineHistory[0].establishedAt,
                                                    mentalHealthStatus: baselineHistory[0].rawAssessmentData?.mentalHealthStatus || 'stable',
                                                    confidenceScore: baselineHistory[0].confidenceScore,
                                                    reasoningData: {
                                                        sleepQuality: baselineHistory[0].baselineMetrics?.sleepQuality,
                                                        sleepHours: baselineHistory[0].baselineMetrics?.sleepHours,
                                                        activityLevel: baselineHistory[0].baselineMetrics?.activityLevel,
                                                        checkInMood: baselineHistory[0].baselineMetrics?.averageMoodScore,
                                                        stepsPerDay: baselineHistory[0].baselineMetrics?.averageStepsPerDay,
                                                        recentExerciseMinutes: baselineHistory[0].baselineMetrics?.exerciseMinutesPerWeek,
                                                        significantChanges: baselineHistory[0].baselineMetrics?.significantPatterns
                                                    },
                                                    metadata: { analysisType: 'baseline' }
                                                })}
                                            />
                                        </View>
                                        
                                        {/* Toggle button - only shown if there are previous baselines */}
                                        {baselineHistory.length > 1 && (
                                            <Pressable 
                                                style={styles.baselineToggleButton}
                                                onPress={() => setShowAllBaselines(!showAllBaselines)}
                                            >
                                                <Text style={styles.baselineToggleText}>
                                                    {showAllBaselines ? 'Hide Previous Baselines' : 'Show Previous Baselines'}
                                                </Text>
                                                <FontAwesome 
                                                    name={showAllBaselines ? 'chevron-up' : 'chevron-down'} 
                                                    size={12} 
                                                    color="#2196F3" 
                                                />
                                            </Pressable>
                                        )}
                                        
                                        {/* Previous baselines - conditionally shown */}
                                        {showAllBaselines && baselineHistory.length > 1 && (
                                            <View style={styles.previousBaselinesContainer}>
                                                <Text style={styles.previousBaselinesHeader}>Previous Baselines</Text>
                                                
                                                {baselineHistory.slice(1).map((baseline) => (
                                                    <View key={baseline._id} style={styles.baselineCard}>
                                                        <MentalHealthHistoryCard
                                                            date={baseline.establishedAt}
                                                            status={baseline.rawAssessmentData?.mentalHealthStatus || 'stable'}
                                                            confidenceScore={baseline.confidenceScore}
                                                            notes={"Previous Mental Health Baseline"}
                                                            onPress={() => openAssessmentDetails({
                                                                _id: baseline._id,
                                                                timestamp: baseline.establishedAt,
                                                                mentalHealthStatus: baseline.rawAssessmentData?.mentalHealthStatus || 'stable',
                                                                confidenceScore: baseline.confidenceScore,
                                                                reasoningData: {
                                                                    sleepQuality: baseline.baselineMetrics?.sleepQuality,
                                                                    sleepHours: baseline.baselineMetrics?.sleepHours,
                                                                    activityLevel: baseline.baselineMetrics?.activityLevel,
                                                                    checkInMood: baseline.baselineMetrics?.averageMoodScore,
                                                                    stepsPerDay: baseline.baselineMetrics?.averageStepsPerDay,
                                                                    recentExerciseMinutes: baseline.baselineMetrics?.exerciseMinutesPerWeek,
                                                                    significantChanges: baseline.baselineMetrics?.significantPatterns
                                                                },
                                                                metadata: { analysisType: 'baseline' }
                                                            })}
                                                        />
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                )}
                                
                                {/* Regular Assessments Section */}
                                {mentalHealthHistory.length > 0 && (
                                    <View style={styles.regularAssessmentsSection}>
                                        <Text style={styles.regularAssessmentsSectionHeader}>MENTAL HEALTH ASSESSMENTS</Text>
                                        
                                        {Object.entries(groupAssessmentsByMonth(mentalHealthHistory)).map(([month, assessments]) => {
                                            // Track the current day being rendered
                                            let currentDay: number | null = null;
                                            
                                            return (
                                                <View key={month}>
                                                    <Text style={styles.monthHeader}>{month}</Text>
                                                    
                                                    {assessments.map((assessment) => {
                                                        const date = new Date(assessment.timestamp);
                                                        const day = date.getDate();
                                                        
                                                        // Determine if this is a new day
                                                        const isNewDay = currentDay !== day;
                                                        currentDay = day;
                                                        
                                                        return (
                                                            <React.Fragment key={assessment._id}>
                                                                {isNewDay && (
                                                                    <Text style={styles.dayHeader}>
                                                                        {date.toLocaleDateString('en-US', { 
                                                                            weekday: 'short', 
                                                                            day: 'numeric' 
                                                                        })}
                                                                    </Text>
                                                                )}
                                                                
                                                                <View style={[
                                                                    !isNewDay && styles.sameDayCard
                                                                ]}>
                                                                    <MentalHealthHistoryCard
                                                                        date={assessment.timestamp}
                                                                        status={assessment.mentalHealthStatus}
                                                                        confidenceScore={assessment.confidenceScore}
                                                                        notes={assessment.reasoningData?.checkInNotes}
                                                                        onPress={() => openAssessmentDetails(assessment)}
                                                                    />
                                                                </View>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        )}
                        
                        {selectedAssessment && (
                            <MentalHealthDetailsModal
                                visible={detailsModalVisible}
                                onClose={closeAssessmentDetails}
                                timestamp={selectedAssessment.timestamp}
                                status={selectedAssessment.mentalHealthStatus}
                                confidenceScore={selectedAssessment.confidenceScore}
                                reasoningData={selectedAssessment.reasoningData || {}}
                                analysisType={selectedAssessment.metadata?.analysisType}
                                assessmentId={selectedAssessment._id}
                            />
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
  loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F5F6FA',
      minHeight: 200,
  },
  container: {
      flex: 1,
      backgroundColor: '#F5F6FA',
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#EEE',
  },
  headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
  },
  tabContainer: {
      flexDirection: 'row',
      padding: 16,
      gap: 8,
      backgroundColor: 'white',
  },
  tabButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: '#F5F6FA',
  },
  activeTabButton: {
      backgroundColor: '#2196F3',
  },
  tabText: {
      textAlign: 'center',
      fontSize: 14,
      color: '#666',
  },
  activeTabText: {
      color: 'white',
  },
  content: {
      flex: 1,
  },
  profilePictureContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      backgroundColor: 'white',
      position: 'relative',
  },
  profilePicture: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#F5F6FA',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#EEE',
  },
  editPictureButton: {
      position: 'absolute',
      right: '35%',
      bottom: 24,
      backgroundColor: 'white',
      width: 30,
      height: 30,
      borderRadius: 15,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#2196F3',
  },
  section: {
      backgroundColor: 'white',
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: '#EEE',
  },
  sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 16,
  },
  infoRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#EEE',
      backgroundColor: 'white',
  },
  infoContent: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      minHeight: 44, // Ensure consistent height
  },
  infoLabel: {
      flex: 1,
      marginRight: 16,
  },
  iconPlaceholder: {
      width: 16,
      height: 16,
      // This maintains the same space as the pencil icon
  },
  labelText: {
      fontSize: 12,
      color: '#666',
      marginBottom: 4,
  },
  infoText: {
      fontSize: 16,
  },
  // Modal Styles
  modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 20,
      width: '90%',
      maxWidth: 400,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
  },
  modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
      color: '#000',
  },
  modalInput: {
      backgroundColor: '#F5F6FA',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: '#E0E0E0',
  },
  modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 16,
      gap: 12,
  },
  modalButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: '#F5F6FA',
      minWidth: 80,
      alignItems: 'center',
  },
  modalButtonText: {
      fontSize: 16,
      color: '#666',
  },
  modalSaveButton: {
      backgroundColor: '#2196F3',
  },
  modalSaveButtonText: {
      color: 'white',
      fontWeight: '600',
  },
  // History Tab Styles - UPDATED
  historyContent: {
      flex: 1,
      padding: 16,
  },
  monthHeader: {
      fontSize: 14,
      color: '#666',
      marginBottom: 8,
      fontWeight: '500',
  },
  dayHeader: {
      fontSize: 13,
      color: '#888',
      marginTop: 12,
      marginBottom: 6,
      fontWeight: '500',
  },
  sameDayCard: {
      marginLeft: 12,
      borderLeftWidth: 1,
      borderLeftColor: '#E0E0E0',
  },
  // Baseline section styles
  baselineSection: {
      marginBottom: 24,
      backgroundColor: '#EFF8FF',
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#2196F3',
  },
  baselineSectionHeader: {
      fontSize: 16,
      fontWeight: '600',
      color: '#2196F3',
      marginBottom: 8,
  },
  baselineHelperText: {
      fontSize: 13,
      color: '#666',
      marginBottom: 12,
      lineHeight: 18,
  },
  currentBaselineCard: {
      marginBottom: 12,
  },
  currentBaselineLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: '#2196F3',
      marginBottom: 4,
  },
  baselineToggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      marginVertical: 8,
      backgroundColor: '#FFFFFF',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#2196F3',
      gap: 8,
  },
  baselineToggleText: {
      fontSize: 14,
      color: '#2196F3',
      fontWeight: '500',
  },
  previousBaselinesContainer: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#D0E6FF',
  },
  previousBaselinesHeader: {
      fontSize: 14,
      color: '#666',
      fontWeight: '500',
      marginBottom: 8,
  },
  baselineCard: {
      marginBottom: 8,
  },
  regularAssessmentsSection: {
      marginBottom: 16,
  },
  regularAssessmentsSectionHeader: {
      fontSize: 15,
      fontWeight: '500',
      color: '#555',
      marginBottom: 16,
  },
  // Empty state styles
  emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      backgroundColor: 'white',
      borderRadius: 12,
      marginTop: 16,
  },
  emptyStateText: {
      fontSize: 16,
      color: '#666',
      textAlign: 'center',
  },
  // Disable state
  disabled: {
      opacity: 0.5,
  }
});