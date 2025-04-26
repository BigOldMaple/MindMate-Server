import React, { useState } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getApiUrl } from '@/services/apiConfig';
import * as SecureStore from 'expo-secure-store';

export default function AnalyzeRecentButton() {
    const [isLoading, setIsLoading] = useState(false);

    const analyzeRecentHealth = async () => {
        setIsLoading(true);

        try {
            // Get auth token
            const token = await SecureStore.getItemAsync('userToken');
            if (!token) {
                Alert.alert('Error', 'Not authenticated. Please log in first.');
                setIsLoading(false);
                return;
            }

            // Call the mental health recent analysis endpoint
            const response = await fetch(`${getApiUrl()}/mental-health/analyze-recent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to analyze recent health data');
            }

            const result = await response.json();

            // Show success message with the result
            Alert.alert(
                'Recent Analysis Completed',
                `Analyzed past 3 days with recency weighting and baseline comparison.
      
      Mental health status: ${result.status}
      Confidence: ${(result.confidenceScore * 100).toFixed(1)}%
      Needs support: ${result.needsSupport ? 'Yes' : 'No'}
      
      ${result.baselineComparison ? `
      Compared to baseline:
      ${result.baselineComparison.sleepChange || ''}
      ${result.baselineComparison.activityChange || ''}
      ${result.baselineComparison.moodChange || ''}
      ` : 'No baseline data available for comparison.'}`,
                [{ text: 'OK' }]
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Pressable
            style={styles.button}
            onPress={analyzeRecentHealth}
            disabled={isLoading}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
                <FontAwesome name="heartbeat" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.buttonText}>
                {isLoading ? 'Analyzing Recent Data...' : 'Analyze Recent Data (vs Baseline)'}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#43A047', // Green color to distinguish from other buttons
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