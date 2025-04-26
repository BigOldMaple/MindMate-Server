import React, { useState } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getApiUrl } from '@/services/apiConfig';
import * as SecureStore from 'expo-secure-store';

export default function EstablishBaselineButton() {
    const [isLoading, setIsLoading] = useState(false);

    const establishBaseline = async () => {
        // Show a confirmation dialog first
        Alert.alert(
            'Establish Mental Health Baseline',
            'This will analyze all your historical health data to establish a baseline for future analyses. This may take a moment. Continue?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Establish Baseline',
                    onPress: async () => {
                        try {
                            setIsLoading(true);

                            // Get auth token
                            const token = await SecureStore.getItemAsync('userToken');
                            if (!token) {
                                Alert.alert('Error', 'Not authenticated. Please log in first.');
                                setIsLoading(false);
                                return;
                            }

                            // Call the baseline establishment endpoint
                            const response = await fetch(`${getApiUrl()}/mental-health/establish-baseline`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                }
                            });

                            if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.error || 'Failed to establish baseline');
                            }

                            const result = await response.json();

                            // Show success message with the result
                            Alert.alert(
                                'Baseline Established',
                                `Your mental health baseline has been successfully established using ${result.dataPoints?.totalDays || 0} days of data.
                 
              Baseline metrics:
              - Sleep Quality: ${result.baselineMetrics?.sleepQuality || 'Not available'}
              - Activity Level: ${result.baselineMetrics?.activityLevel || 'Not available'}
              - Average Mood: ${result.baselineMetrics?.averageMoodScore?.toFixed(1) || 'Not available'}/5
              
              Data completeness: ${((result.dataPoints?.daysWithSleepData || 0) / (result.dataPoints?.totalDays || 1) * 100).toFixed(0)}% of days had sleep data
              ${((result.dataPoints?.daysWithActivityData || 0) / (result.dataPoints?.totalDays || 1) * 100).toFixed(0)}% of days had activity data`,
                                [{ text: 'OK' }]
                            );
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <Pressable
            style={styles.button}
            onPress={establishBaseline}
            disabled={isLoading}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
                <FontAwesome name="database" size={20} color="#FFFFFF" />
            )}
            <Text style={styles.buttonText}>
                {isLoading ? 'Establishing Baseline...' : 'Establish Mental Health Baseline'}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        backgroundColor: '#1976D2', // Blue color to distinguish from other buttons
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