// components/SyncHealthDataButton.tsx
import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { syncHistoricalHealthData } from '@/services/healthConnectService';

/**
 * Button component for manually syncing historical health data
 */
const SyncHealthDataButton = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      
      // Call sync function with forceFullSync=true to retrieve all historical data
      const result = await syncHistoricalHealthData();
      
      if (result.success) {
        Alert.alert(
          'Health Data Synced',
          `Successfully synced health data for ${result.days || 0} days`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Sync Failed',
          result.message || 'Failed to sync health data',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Health data sync error:', error);
      Alert.alert(
        'Sync Error',
        error instanceof Error ? error.message : 'Unknown error occurred',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, isSyncing && styles.buttonDisabled]}
      onPress={handleSync}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color="#fff" style={styles.icon} />
      ) : (
        <FontAwesome name="sync" size={18} color="#fff" style={styles.icon} />
      )}
      <Text style={styles.buttonText}>
        {isSyncing ? 'Syncing Historical Health Data...' : 'Sync Health Data'}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  icon: {
    marginRight: 8,
  },
});

export default SyncHealthDataButton;