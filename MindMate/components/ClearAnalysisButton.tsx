import React, { useState } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getApiUrl } from '@/services/apiConfig';
import * as SecureStore from 'expo-secure-store';

export default function ClearAnalysisButton() {
  const [isLoading, setIsLoading] = useState(false);

  const clearAnalysis = async () => {
    setIsLoading(true);
    
    try {
      // Get auth token
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in first.');
        setIsLoading(false);
        return;
      }
      
      // Call the new endpoint to clear mental health assessments
      const response = await fetch(`${getApiUrl()}/mental-health/admin/clear-assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear assessments');
      }
      
      const result = await response.json();
      
      // Show success message
      Alert.alert(
        'Assessments Cleared',
        result.message || 'All mental health assessments have been cleared.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error clearing assessments:', error);
      Alert.alert(
        'Operation Failed',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      style={styles.button}
      onPress={clearAnalysis}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <FontAwesome name="trash" size={20} color="#FFFFFF" />
      )}
      <Text style={styles.buttonText}>
        {isLoading ? 'Clearing...' : 'Clear Mental Health Data'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#D32F2F', // Red color to indicate a destructive action
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  }
});