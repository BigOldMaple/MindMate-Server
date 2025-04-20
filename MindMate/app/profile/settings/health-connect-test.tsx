// app/profile/settings/health-connect-test.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function HealthConnectTestScreen() {
  const router = useRouter();
  const [hasPermissions, setHasPermissions] = useState(false);

  // Handler for status updates from the HealthConnectComponent
  const handleStatusChange = (status: { available: boolean; hasPermissions: boolean }) => {
    console.log('Health Connect status update:', status);
    setHasPermissions(status.hasPermissions);
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
          <Text style={styles.headerTitle}>Health Connect Test</Text>
        </View>

        <ScrollView style={styles.content}>

          {/* Only show this section if permissions are granted */}
          {hasPermissions && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Success!</Text>
              <Text style={styles.infoText}>
                Your app is now properly registered with Health Connect and has permission to access step data.
              </Text>
              <Text style={styles.infoText}>
                You can now use Health Connect features in your app.
              </Text>
            </View>
          )}

          {/* Information Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About Health Connect</Text>
            <Text style={styles.infoText}>
              Health Connect allows fitness apps to share health and fitness data with each other.
              This screen demonstrates how MindMate can retrieve step data from Health Connect.
            </Text>
            <Text style={styles.infoText}>
              For this to work, you need to have:
            </Text>
            <View style={styles.bulletList}>
              <Text style={styles.bulletPoint}>• An Android device</Text>
              <Text style={styles.bulletPoint}>• Health Connect app installed</Text>
              <Text style={styles.bulletPoint}>• At least one fitness app that records steps and shares them with Health Connect</Text>
            </View>
            <Text style={styles.infoText}>
              This feature allows MindMate to track your steps even when the app is closed.
            </Text>
          </View>
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
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    lineHeight: 20,
  },
});