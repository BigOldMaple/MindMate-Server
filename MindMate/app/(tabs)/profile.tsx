// app/(tabs)/profile.tsx
import { StyleSheet, ScrollView, Pressable, View as DefaultView, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, UserProfile, EmergencyContact } from '../../server/services/profileApi';
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

export default function ProfileScreen() {
    const [activeTab, setActiveTab] = useState('account');
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [editingField, setEditingField] = useState<string | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        fetchProfile();
    }, []);

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
        
{/* Mental Health History Tab*/}

        {activeTab === 'history' && (
          <ScrollView style={styles.historyContent}>
            {/* Month Section */}
            <Text style={styles.monthHeader}>November 2023</Text>

            {/* History Cards */}
            <Pressable style={styles.historyCard}>
              <View style={styles.historyCardContent}>
                <View style={styles.dateScoreContainer}>
                  <Text style={styles.dateText}>Nov28</Text>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>86% </Text>
                    <FontAwesome name="arrow-up" size={12} color="#4CAF50" />
                  </View>
                </View>
                <Text style={styles.noteText}>Feeling more energetic, sleep improving</Text>
                <Text style={styles.detailsLink}>View Details</Text>
              </View>
            </Pressable>

            <Pressable style={styles.historyCard}>
              <View style={styles.historyCardContent}>
                <View style={styles.dateScoreContainer}>
                  <Text style={styles.dateText}>Nov21</Text>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>72% </Text>
                    <FontAwesome name="minus" size={12} color="#FFA726" />
                  </View>
                </View>
                <Text style={styles.noteText}>Regular day, maintaining routine</Text>
                <Text style={styles.detailsLink}>View Details</Text>
              </View>
            </Pressable>


          </ScrollView>
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
  // History Tab Styles
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
  historyCard: {
      backgroundColor: 'white',
      borderRadius: 12,
      marginBottom: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
  },
  historyCardContent: {
      gap: 8,
  },
  dateScoreContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
  },
  dateText: {
      fontSize: 16,
      fontWeight: '600',
  },
  scoreContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
  },
  scoreText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#2196F3',
  },
  noteText: {
      fontSize: 14,
      color: '#666',
  },
  detailsLink: {
      fontSize: 14,
      color: '#2196F3',
      alignSelf: 'flex-end',
  },
  // Add button style for edit icons
  editButton: {
      padding: 8,
      borderRadius: 20,
  },
  // Error state styles
  errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
  },
  errorText: {
      fontSize: 16,
      color: '#FF3B30',
      textAlign: 'center',
      marginBottom: 16,
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
  // Empty state styles
  emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
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