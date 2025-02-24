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

export default function SettingsScreen() {
  const [isDoNotDisturb, setIsDoNotDisturb] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const { signOut } = useAuth();

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
              await checkInApi.resetCheckInTimer();
              Alert.alert('Success', 'Check-in timer has been reset');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset check-in timer');
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
          <Text style={styles.sectionHeader}>PRIVACY & NOTIFICATIONS</Text>
          <Pressable style={styles.menuItem}>
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

          {/* Add the new Reset Check-in Timer button */}
          <Pressable
            style={styles.menuItem}
            onPress={handleResetCheckInTimer}
          >
            <View style={styles.leftContent}>
              <FontAwesome name="clock-o" size={20} color="#666" style={styles.icon} />
              <View>
                <Text style={styles.menuTitle}>Reset Check-in Timer</Text>
                <Text style={styles.menuSubtitle}>Developer tool to reset check-in cooldown</Text>
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