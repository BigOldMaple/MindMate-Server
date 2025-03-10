import { StyleSheet, ScrollView, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/services/auth';
import { Stack, Link } from 'expo-router';
import React from 'react';
import { checkInApi } from '@/services/checkInApi';
import { notificationService } from '@/services/notificationService';
import { notificationsApi, Notification as NotificationType } from '@/services/notificationsApi';
import * as SecureStore from 'expo-secure-store';


export default function SettingsScreen() {
  const [isDoNotDisturb, setIsDoNotDisturb] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();
  const [isResetting, setIsResetting] = useState(false);

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoggingOut(true);
              // Call the auth service logout function
              await auth.logout();
              // Update the auth context
              await signOut();
              // Router.replace is handled by AuthContext
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(
                "Error",
                "Failed to logout. Please try again."
              );
            } finally {
              setIsLoggingOut(false);
            }
          }
        }
      ]
    );
  };

  const refreshNotifications = async (): Promise<void> => {
    try {
      // For immediate refresh of notifications when the user goes to the notifications screen,
      // we'll store a flag in secure storage that the notifications screen can check
      await SecureStore.setItemAsync('shouldRefreshNotifications', 'true');

      // We could also directly fetch notifications here to warm the cache
      await notificationsApi.getNotifications();

      console.log('Notifications refreshed after timer reset');
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  };

  const handleResetCheckInTimer = async () => {
    Alert.alert(
      "Reset Check-in Timer",
      "Are you sure you want to reset the check-in timer? This is for development purposes only.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              // Show loading indicator
              setIsResetting(true);

              // First reset the timer on the server
              const response = await checkInApi.resetCheckInTimer();

              // Clear any local cached check-in status
              try {
                await SecureStore.deleteItemAsync('lastCheckInTime');
                await SecureStore.deleteItemAsync('nextCheckInTime');
              } catch (cacheError) {
                console.error('Error clearing cached check-in status:', cacheError);
                // Continue even if cache clearing fails
              }

              // Clear any existing check-in related notifications
              try {
                const notifications = await notificationsApi.getNotifications();

                // Find any check-in related notifications
                const checkInNotifications = notifications.filter(
                  n => n.type === 'wellness' &&
                    (n.title === 'Check-In Complete' ||
                      n.title === 'Check-In Available' ||
                      n.title === 'Check-In Available Soon')
                );

                // Delete each notification
                for (const notification of checkInNotifications) {
                  const notificationId = notification.id || notification._id;
                  if (notificationId) {
                    try {
                      await notificationsApi.deleteNotification(notificationId);
                    } catch (err) {
                      console.error('Error deleting notification:', err);
                    }
                  }
                }
              } catch (notifError) {
                console.error('Error handling notifications during reset:', notifError);
              }

              // Manually create a new Check-In Available notification if one wasn't returned by the server
              if (response?.notification?.id) {
                console.log('Server created notification:', response.notification);
              } else {
                try {
                  // Create a new notification locally
                  const newNotification: NotificationType = {
                    type: 'wellness',
                    title: 'Check-In Available',
                    message: 'Your next check-in is now available. How are you feeling today?',
                    read: false,
                    time: new Date(),
                    actionable: true,
                    actionRoute: '/home/check_in'
                  };

                  await notificationsApi.createNotification(newNotification);
                  console.log('Created local notification for check-in availability');
                } catch (createErr) {
                  console.error('Error creating local notification:', createErr);
                }
              }

              // Then trigger a local push notification
              await notificationService.sendTestNotification();
              await refreshNotifications();
              Alert.alert(
                'Success',
                'Check-in timer has been reset. You should now have a new Check-In Available notification.'
              );
            } catch (error) {
              console.error('Reset timer error:', error);
              Alert.alert('Error', 'Failed to reset check-in timer');
            } finally {
              setIsResetting(false);
            }
          }
        }
      ]
    );
  };
  const handleSendTestNotification = async () => {
    Alert.alert(
      "Send Test Notification",
      "Send a test notification?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Send",
          onPress: async () => {
            try {
              const notificationId = await notificationService.sendTestNotification();
              console.log('Test notification sent with ID:', notificationId);
              Alert.alert('Success', 'Test notification sent');
            } catch (error) {
              console.error('Error sending test notification:', error);
              Alert.alert('Error', 'Failed to send test notification');
            }
          }
        }
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <ScrollView style={styles.content}>
          {/* Support Network Section */}
          <Text style={styles.sectionHeader}>SUPPORT NETWORK</Text>
          <Link href="../home/support_network" asChild>
            <Pressable style={styles.menuItem}>
              <View style={styles.leftContent}>
                <FontAwesome name="group" size={20} color="#666" style={styles.icon} />
                <View>
                  <Text style={styles.menuTitle}>My Support Network</Text>
                  <Text style={styles.menuSubtitle}>3 supporters</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </Link>

          {/* Privacy & Notifications Section */}
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/profile/settings/privacy')}
          >
            <View style={styles.leftContent}>
              <FontAwesome name="lock" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Privacy Settings</Text>
                <Text style={styles.menuSubtitle}>Manage data sharing and permissions</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.leftContent}>
              <FontAwesome name="bell" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Notification Settings</Text>
                <Text style={styles.menuSubtitle}>Configure alerts and reminders</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={styles.menuItem}>
            <View style={styles.leftContent}>
              <FontAwesome name="bed" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Do Not Disturb</Text>
                <Text style={styles.menuSubtitle}>Manage timing and permissions</Text>
              </View>
            </View>
            <Switch
              value={isDoNotDisturb}
              onValueChange={setIsDoNotDisturb}
              trackColor={{ false: '#D1D1D6', true: '#81B0FF' }}
              thumbColor={isDoNotDisturb ? '#2196F3' : '#f4f3f4'}
            />
          </View>

          {/* Account Section */}
          <Text style={styles.sectionHeader}>ACCOUNT</Text>
          <Pressable style={styles.menuItem}>
            <View style={styles.leftContent}>
              <FontAwesome name="database" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Data</Text>
                <Text style={styles.menuSubtitle}>View terms and manage your data</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* Development & Testing Section */}
          <Text style={styles.sectionHeader}>DEVELOPMENT & TESTING</Text>
          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('../../test/sensors')}
          >
            <View style={styles.leftContent}>
              <FontAwesome name="mobile" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Sensor Test</Text>
                <Text style={styles.menuSubtitle}>Test device sensors and motion</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('../profile/settings/health-connect-test')}
          >
            <View style={styles.leftContent}>
              <FontAwesome name="heartbeat" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Health Connect Test</Text>
                <Text style={styles.menuSubtitle}>Test Google Health Connect integration</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>


          {/* Reset Check-in Timer button */}
          <Pressable
            style={[styles.menuItem, isResetting && styles.disabledMenuItem]}
            onPress={handleResetCheckInTimer}
            disabled={isResetting}
          >
            <View style={styles.leftContent}>
              <FontAwesome name="clock-o" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Reset Check-in Timer</Text>
                <Text style={styles.menuSubtitle}>Developer tool to reset check-in cooldown</Text>
              </View>
            </View>
            {isResetting ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>

          {/* Test Notification button */}
          <Pressable
            style={styles.menuItem}
            onPress={handleSendTestNotification}
          >
            <View style={styles.leftContent}>
              <FontAwesome name="bell" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Send Test Notification</Text>
                <Text style={styles.menuSubtitle}>Developer tool to test push notifications</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* Logout Button */}
          <Pressable
            style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator color="#FF3B30" />
            ) : (
              <>
                <FontAwesome name="sign-out" size={20} color="#FF3B30" />
                <Text style={styles.logoutText}>Log Out</Text>
              </>
            )}
          </Pressable>
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
  content: {
    flex: 1,
  },
  disabledMenuItem: {
    opacity: 0.6,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#F5F6FA',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 16,
    width: 24,
  },
  menuTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  menuSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  chevron: {
    fontSize: 24,
    color: '#666',
    marginTop: -2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'white',
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    color: '#FF3B30',
    marginLeft: 12,
    fontSize: 16,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  }
});