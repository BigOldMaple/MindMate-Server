import React, { useState } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getApiUrl } from '@/services/apiConfig';
import * as SecureStore from 'expo-secure-store';

export default function TriggerAnalysisButton() {
  const [isLoading, setIsLoading] = useState(false);

  const triggerAnalysis = async () => {
    setIsLoading(true);
    
    try {
      // Get auth token
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) {
        Alert.alert('Error', 'Not authenticated. Please log in first.');
        setIsLoading(false);
        return;
      }
      
      // Call the mental health analysis endpoint
      const response = await fetch(`${getApiUrl()}/mental-health/assess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to trigger analysis');
      }
      
      const result = await response.json();
      
      // Show success message with the result
      Alert.alert(
        'Analysis Completed',
        `Mental health status: ${result.status}\nConfidence: ${(result.confidenceScore * 100).toFixed(1)}%\nNeeds support: ${result.needsSupport ? 'Yes' : 'No'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error triggering analysis:', error);
      Alert.alert(
        'Analysis Failed',
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Pressable
      style={styles.button}
      onPress={triggerAnalysis}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <FontAwesome name="stethoscope" size={20} color="#FFFFFF" />
      )}
      <Text style={styles.buttonText}>
        {isLoading ? 'Running Analysis...' : 'Trigger Mental Health Analysis'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#8E44AD', // Purple color to distinguish from other buttons
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