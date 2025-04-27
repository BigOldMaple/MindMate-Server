import React, { useState } from 'react';
import { StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { getApiUrl } from '@/services/apiConfig';
import * as SecureStore from 'expo-secure-store';
import RecentAnalysisResultsModal from './RecentAnalysisResultsModal';

export default function AnalyzeRecentButton() {
    const [isLoading, setIsLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);

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

            // Step 1: Perform the recent analysis
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
            
            // Step 2: Fetch the raw analyzed data for the "View Analyzed Data" functionality
            try {
                const rawDataResponse = await fetch(`${getApiUrl()}/mental-health/recent/analyzed-data`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (rawDataResponse.ok) {
                    const rawDataResult = await rawDataResponse.json();
                    
                    // Combine the results with the raw data
                    result.rawData = {
                        healthData: rawDataResult.healthData || [],
                        checkIns: rawDataResult.checkIns || []
                    };
                }
            } catch (error) {
                console.error('Error fetching raw data:', error);
                // Continue even if raw data fetch fails - the main analysis was successful
            }
            
            // Store the result and show modal
            setAnalysisResult(result);
            setModalVisible(true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            Alert.alert('Error', `Failed to analyze recent health data: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => {
        setModalVisible(false);
    };

    return (
        <>
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
            
            {/* Custom modal for displaying analysis results */}
            <RecentAnalysisResultsModal
                visible={modalVisible}
                onClose={handleCloseModal}
                status={analysisResult?.status}
                confidenceScore={analysisResult?.confidenceScore}
                needsSupport={analysisResult?.needsSupport}
                baselineComparison={analysisResult?.baselineComparison}
                metrics={{
                    sleepQuality: analysisResult?.reasoning?.sleepQuality,
                    sleepHours: analysisResult?.reasoning?.sleepHours,
                    activityLevel: analysisResult?.reasoning?.activityLevel,
                    stepsPerDay: analysisResult?.reasoning?.stepsPerDay,
                    checkInMood: analysisResult?.reasoning?.averageMood,
                    exerciseMinutes: analysisResult?.reasoning?.recentExerciseMinutes
                }}
                significantChanges={analysisResult?.reasoning?.significantChanges}
                rawData={analysisResult?.rawData}
            />
        </>
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