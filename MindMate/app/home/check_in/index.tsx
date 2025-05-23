import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, View as DefaultView, TextInput, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, Stack } from 'expo-router';
import { checkInApi } from '../../../services/checkInApi';
import { notificationsApi, Notification as NotificationType } from '../../../services/notificationsApi';
// Types for our check-in data
interface MoodData {
  score: number;
  label: string;
  description: string;
  color: string;
  icon: string;
}

interface ActivityData {
  type: string;
  level: 'low' | 'moderate' | 'high';
  icon: string;
}

// Predefined data
const moodOptions: MoodData[] = [
  { score: 1, label: 'Very Low', description: 'Feeling very down', color: '#FF6B6B', icon: 'frown-o' },
  { score: 2, label: 'Low', description: 'Not feeling great', color: '#FFA06B', icon: 'meh-o' },
  { score: 3, label: 'Neutral', description: 'Feeling okay', color: '#FFD93D', icon: 'minus' },
  { score: 4, label: 'Good', description: 'Feeling positive', color: '#6BCB77', icon: 'smile-o' },
  { score: 5, label: 'Very Good', description: 'Feeling great', color: '#4D96FF', icon: 'smile-o' }
];

const activityOptions: ActivityData[] = [
  { type: 'Sleep', level: 'moderate', icon: 'bed' },
  { type: 'Exercise', level: 'low', icon: 'heartbeat' },
  { type: 'Social', level: 'high', icon: 'users' },
  { type: 'Work', level: 'moderate', icon: 'briefcase' }
];

const CheckInScreen = () => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedMood, setSelectedMood] = useState<MoodData | null>(null);
  const [moodDescription, setMoodDescription] = useState('');
  const [activities, setActivities] = useState<{ [key: string]: string }>({});
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isInCooldown, setIsInCooldown] = useState(false);
  const [nextCheckInTime, setNextCheckInTime] = useState<Date | null>(null);

  // Verify check-in status when the screen loads
  useEffect(() => {
    const verifyCheckInStatus = async () => {
      try {
        setIsCheckingStatus(true);
        const status = await checkInApi.getCheckInStatus();
        
        if (!status.canCheckIn) {
          setIsInCooldown(true);
          if (status.nextCheckInTime) {
            setNextCheckInTime(new Date(status.nextCheckInTime));
          }
          
          // We don't need to immediately navigate back - just show the cooldown state
          // This provides a better UX by explaining why they can't check in
        }
      } catch (error) {
        console.error('Error checking check-in status:', error);
        // If we can't verify status, assume they can check in
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    verifyCheckInStatus();
  }, []);

  const handleMoodSelect = (mood: MoodData) => {
    setSelectedMood(mood);
  };

  const handleContinue = () => {
    setStep(2);
  };

  const handleActivitySelect = (activity: ActivityData, level: 'low' | 'moderate' | 'high') => {
    setActivities(prev => ({
      ...prev,
      [activity.type]: level
    }));
  };

  const getSelectedActivitiesCount = () => {
    return Object.keys(activities).length;
  };

  const isSubmitValid = getSelectedActivitiesCount() >= 3;

  const handleSubmit = async () => {
    try {
      const checkInData = {
        mood: {
          score: selectedMood!.score,
          label: selectedMood!.label,
          description: moodDescription
        },
        activities: Object.entries(activities).map(([type, level]) => ({
          type,
          level: level as 'low' | 'moderate' | 'high'
        }))
      };
      
      console.log('Submitting check-in data:', checkInData);
      
      const response = await checkInApi.submitCheckIn(checkInData);
      console.log('API response:', response);
      
      // Transform check-in notifications instead of just marking them as read
      try {
        // Get all notifications
        const notifications = await notificationsApi.getNotifications();
        
        // Filter for check-in related notifications
        const checkInNotifications = notifications.filter(
          n => n.type === 'wellness' && 
               (n.title === 'Check-In Available' || n.title === 'Check-In Available Soon')
        );
        
        // For each notification, create a "completed" version and delete the original
        for (const notification of checkInNotifications) {
          // Create a completion notification
          const moodEmoji = getMoodEmoji(selectedMood!.score);
          const completedMessage = `You rated your mood as ${selectedMood!.label} ${moodEmoji} and logged ${getSelectedActivitiesCount()} activities.`;
          
          try {
            // First create the new "completed" notification with proper typing
            const completedNotification: NotificationType = {
              type: 'wellness',
              title: 'Check-In Complete',
              message: completedMessage,
              read: false,
              time: new Date(),
              actionable: false
            };
            
            // Create the notification through API
            await notificationsApi.createNotification(completedNotification);
            
            // Then mark as read the original "available" notification
            const notificationId = notification.id || notification._id;
            if (notificationId) {
              await notificationsApi.markAsRead(notificationId);
            }
          } catch (notifErr) {
            console.error('Error transforming notification:', notifErr);
            // Continue with other notifications even if one fails
          }
        }
      } catch (err) {
        console.error('Error handling check-in notifications:', err);
        // Continue even if notification handling fails
      }
      
      // Show success message
      Alert.alert('Success', 'Check-in submitted successfully');
      router.back();
    } catch (error) {
      console.error('Check-in submission error:', error);
      Alert.alert('Error', 'Failed to submit check-in. Please try again.');
    }
  };
  
  // Helper function to get emoji based on mood score
  const getMoodEmoji = (score: number): string => {
    switch(score) {
      case 1: return '😔';
      case 2: return '😐';
      case 3: return '😊';
      case 4: return '😃';
      case 5: return '😄';
      default: return '😊';
    }
  };

  const isStepOneValid = selectedMood !== null;

  // Show loading screen while checking status
  if (isCheckingStatus) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Checking availability...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // If in cooldown, show the cooldown screen
  if (isInCooldown) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Daily Check-in</Text>
            <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</Text>
          </View>
        </View>
        
        <View style={styles.cooldownContainer}>
          <FontAwesome name="clock-o" size={64} color="#666" />
          <Text style={styles.cooldownTitle}>Check-In Not Available</Text>
          <Text style={styles.cooldownText}>
            You have already completed your check-in for today.
          </Text>
          {nextCheckInTime && (
            <Text style={styles.cooldownText}>
              Next check-in available: {nextCheckInTime.toLocaleString()}
            </Text>
          )}
          <Pressable
            style={styles.backToHomeButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToHomeButtonText}>Back to Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Regular check-in form when user can check in
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Daily Check-in</Text>
            <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</Text>
          </View>
        </View>

        {/* Progress Indicator */}
        <DefaultView style={styles.progressContainer}>
          {[1, 2].map(number => (
            <DefaultView
              key={number}
              style={[
                styles.progressDot,
                step >= number && styles.progressDotActive
              ]}
            />
          ))}
        </DefaultView>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {step === 1 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How are you feeling today?</Text>

              <DefaultView style={styles.moodGrid}>
                <DefaultView style={styles.topRow}>
                  {moodOptions.slice(0, 3).map((mood) => (
                    <DefaultView key={mood.score} style={styles.moodOptionWrapper}>
                      <Pressable
                        style={[
                          styles.moodOption,
                          selectedMood?.score === mood.score && styles.selectedMood
                        ]}
                        onPress={() => handleMoodSelect(mood)}
                      >
                        <FontAwesome
                          name={mood.icon as any}
                          size={32}
                          color={mood.color}
                          style={styles.moodIcon}
                        />
                        <Text style={styles.moodLabel}>{mood.label}</Text>
                      </Pressable>
                    </DefaultView>
                  ))}
                </DefaultView>
                <DefaultView style={styles.bottomRow}>
                  {moodOptions.slice(3).map((mood) => (
                    <DefaultView key={mood.score} style={styles.moodOptionWrapper}>
                      <Pressable
                        style={[
                          styles.moodOption,
                          selectedMood?.score === mood.score && styles.selectedMood
                        ]}
                        onPress={() => handleMoodSelect(mood)}
                      >
                        <FontAwesome
                          name={mood.icon as any}
                          size={32}
                          color={mood.color}
                          style={styles.moodIcon}
                        />
                        <Text style={styles.moodLabel}>{mood.label}</Text>
                      </Pressable>
                    </DefaultView>
                  ))}
                </DefaultView>
              </DefaultView>

              <DefaultView style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>Add any additional thoughts (Optional)</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Describe how you're feeling..."
                  value={moodDescription}
                  onChangeText={setMoodDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </DefaultView>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity Levels</Text>
              <DefaultView style={styles.activitiesContainer}>
                {activityOptions.map((activity) => (
                  <DefaultView key={activity.type} style={styles.activityItem}>
                    <DefaultView style={styles.activityHeader}>
                      <FontAwesome name={activity.icon as any} size={20} color="#666" />
                      <Text style={styles.activityLabel}>{activity.type}</Text>
                    </DefaultView>
                    <DefaultView style={styles.levelButtons}>
                      {['low', 'moderate', 'high'].map((level) => (
                        <Pressable
                          key={level}
                          style={[
                            styles.levelButton,
                            activities[activity.type] === level && styles.selectedLevel
                          ]}
                          onPress={() => handleActivitySelect(activity, level as any)}
                        >
                          <Text
                            style={[
                              styles.levelButtonText,
                              activities[activity.type] === level && styles.selectedLevelText
                            ]}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </Text>
                        </Pressable>
                      ))}
                    </DefaultView>
                  </DefaultView>
                ))}
              </DefaultView>
            </View>
          )}
        </ScrollView>

        {/* Fixed Bottom Button */}
        <DefaultView style={styles.bottomButtonContainer}>
          {step === 1 ? (
            <Pressable
              style={[styles.continueButton, !isStepOneValid && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!isStepOneValid}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          ) : (
            <View>
              <Text style={styles.activityRequirement}>
                {`Rate at least 3 activities (${getSelectedActivitiesCount()}/3)`}
              </Text>
              <Pressable
                style={[styles.submitButton, !isSubmitValid && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!isSubmitValid}
              >
                <Text style={styles.submitButtonText}>Complete Check-in</Text>
              </Pressable>
            </View>
          )}
        </DefaultView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DDD',
  },
  progressDotActive: {
    backgroundColor: '#2196F3',
  },
  section: {
    padding: 16,
    backgroundColor: '#F5F6FA',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  moodGrid: {
    marginBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  moodOptionWrapper: {
    width: 100,
    height: 100,
  },
  moodOption: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedMood: {
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  moodIcon: {
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  descriptionContainer: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  descriptionLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  descriptionInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  bottomButtonContainer: {
    padding: 16,
    backgroundColor: '#F5F6FA',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  continueButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  activitiesContainer: {
    gap: 16,
    marginBottom: 16,
  },
  activityItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  activityLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  levelButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  levelButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F6FA',
    alignItems: 'center',
  },
  selectedLevel: {
    backgroundColor: '#2196F3',
  },
  levelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  selectedLevelText: {
    color: 'white',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activityRequirement: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  // Additional styles for new components
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  cooldownContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5F6FA',
  },
  cooldownTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  cooldownText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  backToHomeButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
  },
  backToHomeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CheckInScreen;