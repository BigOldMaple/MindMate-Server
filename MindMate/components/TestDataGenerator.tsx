// components/TestDataGenerator.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { healthTestingApi } from '@/services/healthTestingApi';

// Define health data pattern types
type HealthPattern = 'good' | 'declining' | 'critical' | 'improving' | 'fluctuating';

// Descriptions of each pattern for the UI
const patternDescriptions: Record<HealthPattern, string> = {
    good: 'Stable sleep, regular exercise, positive mood',
    declining: 'Decreasing sleep quality, reduced activity, declining mood',
    critical: 'Poor sleep, minimal activity, very low mood',
    improving: 'Improving from low baseline, increasing activity and better mood',
    fluctuating: 'Inconsistent patterns, varying between good and poor metrics'
};

const TestDataGenerator = () => {
    const [selectedPattern, setSelectedPattern] = useState<HealthPattern | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [daysToGenerate, setDaysToGenerate] = useState(7);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState('');
    const [showClearOptions, setShowClearOptions] = useState(false);
    const [isClearingData, setIsClearingData] = useState(false);

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(false);
        if (selectedDate) {
            setSelectedDate(selectedDate);
        }
    };

    const validateDates = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
            Alert.alert('Invalid Date', 'Start date cannot be in the future');
            return false;
        }

        return true;
    };

    const generateTestData = async () => {
        if (!selectedPattern) {
            Alert.alert('Error', 'Please select a health pattern');
            return;
        }

        if (!validateDates()) {
            return;
        }

        try {
            setIsGenerating(true);
            setResult('');

            const response = await healthTestingApi.generateTestData({
                pattern: selectedPattern,
                startDate: selectedDate.toISOString(),
                days: daysToGenerate
            });

            if (response.success) {
                const metrics = response.metrics;
                setResult(`Successfully generated ${selectedPattern} test data for ${daysToGenerate} days starting from ${selectedDate.toLocaleDateString()}
        
${metrics ? `Generated data:
• Days: ${metrics.daysGenerated}
• Sleep records: ${metrics.sleepRecords}
• Activity records: ${metrics.activityRecords}
• Exercise records: ${metrics.exerciseRecords}` : ''}
        `);
            } else {
                throw new Error(response.message || 'Unknown error');
            }
        } catch (error) {
            console.error('Error generating test data:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to generate test data');
            setResult(`Failed to generate test data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const clearTestData = async () => {
        if (!validateDates()) {
            return;
        }

        try {
            setIsClearingData(true);

            // Calculate end date based on days to generate
            const endDate = new Date(selectedDate);
            endDate.setDate(endDate.getDate() + daysToGenerate - 1);

            const response = await healthTestingApi.clearTestData(
                selectedDate.toISOString(),
                endDate.toISOString()
            );

            if (response.success) {
                setResult(`Successfully cleared ${response.count || 'all'} test data records from ${selectedDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
            } else {
                throw new Error(response.message || 'Unknown error');
            }
        } catch (error) {
            console.error('Error clearing test data:', error);
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to clear test data');
            setResult(`Failed to clear test data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsClearingData(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Health Data Test Generator</Text>
            <Text style={styles.description}>
                Generate synthetic health data with specific patterns to test the LLM's analysis capabilities.
            </Text>

            {/* Pattern Selection */}
            <Text style={styles.sectionTitle}>Select Health Pattern</Text>
            <View style={styles.patternContainer}>
                {Object.keys(patternDescriptions).map((pattern) => (
                    <Pressable
                        key={pattern}
                        style={[
                            styles.patternButton,
                            selectedPattern === pattern && styles.selectedPattern,
                            pattern === 'good' && styles.goodPattern,
                            pattern === 'declining' && styles.decliningPattern,
                            pattern === 'critical' && styles.criticalPattern,
                            pattern === 'improving' && styles.improvingPattern,
                            pattern === 'fluctuating' && styles.fluctuatingPattern,
                        ]}
                        onPress={() => setSelectedPattern(pattern as HealthPattern)}
                    >
                        <Text
                            style={[
                                styles.patternText,
                                selectedPattern === pattern && styles.selectedPatternText
                            ]}
                        >
                            {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                        </Text>
                        <Text style={styles.patternDescription}>
                            {patternDescriptions[pattern as HealthPattern]}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Date Selection */}
            <Text style={styles.sectionTitle}>Select Start Date</Text>
            <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
            >
                <Text style={styles.dateButtonText}>
                    {selectedDate.toLocaleDateString()}
                </Text>
            </Pressable>
            {showDatePicker && (
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                />
            )}

            {/* Days Selection */}
            <Text style={styles.sectionTitle}>Number of Days to Generate</Text>
            <View style={styles.daysContainer}>
                {[3, 7, 14, 30].map((days) => (
                    <Pressable
                        key={days}
                        style={[
                            styles.dayButton,
                            daysToGenerate === days && styles.selectedDayButton
                        ]}
                        onPress={() => setDaysToGenerate(days)}
                    >
                        <Text
                            style={[
                                styles.dayButtonText,
                                daysToGenerate === days && styles.selectedDayButtonText
                            ]}
                        >
                            {days} days
                        </Text>
                    </Pressable>
                ))}
            </View>

            {/* Generate Button */}
            <Pressable
                style={[styles.generateButton, !selectedPattern && styles.disabledButton]}
                onPress={generateTestData}
                disabled={!selectedPattern || isGenerating}
            >
                {isGenerating ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                    <Text style={styles.generateButtonText}>Generate Test Data</Text>
                )}
            </Pressable>

            {/* Clear Data Section */}
            <Pressable
                style={styles.clearToggleButton}
                onPress={() => setShowClearOptions(!showClearOptions)}
            >
                <Text style={styles.clearToggleText}>
                    {showClearOptions ? 'Hide Clear Options' : 'Show Clear Options'}
                </Text>
            </Pressable>

            {showClearOptions && (
                <View style={styles.clearContainer}>
                    <Text style={styles.clearDescription}>
                        Clear test data for the selected date range. This will remove all data generated for testing purposes.
                    </Text>
                    <Pressable
                        style={[styles.clearButton, isClearingData && styles.disabledButton]}
                        onPress={() => {
                            Alert.alert(
                                'Clear Test Data',
                                `Are you sure you want to clear all test data from ${selectedDate.toLocaleDateString()} for ${daysToGenerate} days?`,
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Clear', style: 'destructive', onPress: clearTestData }
                                ]
                            );
                        }}
                        disabled={isClearingData}
                    >
                        {isClearingData ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.clearButtonText}>Clear Test Data</Text>
                        )}
                    </Pressable>
                </View>
            )}

            {/* Result */}
            {result ? (
                <View style={styles.resultContainer}>
                    <Text style={styles.resultText}>{result}</Text>
                    <Text style={styles.hintText}>
                        Don't forget to run "Establish Baseline" or "Analyze Recent" to see how the LLM interprets this data.
                    </Text>
                </View>
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    description: {
        fontSize: 14,
        color: '#666',
        marginBottom: 16,
        lineHeight: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        color: '#444',
    },
    patternContainer: {
        marginBottom: 16,
    },
    patternButton: {
        padding: 12,
        marginVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DDD',
        backgroundColor: '#F8F8F8',
    },
    selectedPattern: {
        borderColor: '#2196F3',
        borderWidth: 2,
    },
    goodPattern: {
        backgroundColor: '#E8F5E9',
    },
    decliningPattern: {
        backgroundColor: '#FFF8E1',
    },
    criticalPattern: {
        backgroundColor: '#FFEBEE',
    },
    improvingPattern: {
        backgroundColor: '#E0F7FA',
    },
    fluctuatingPattern: {
        backgroundColor: '#F3E5F5',
    },
    patternText: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    selectedPatternText: {
        color: '#2196F3',
    },
    patternDescription: {
        fontSize: 12,
        color: '#666',
    },
    dateButton: {
        padding: 12,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 8,
        backgroundColor: '#FFF',
        alignItems: 'center',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#333',
    },
    daysContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginVertical: 8,
    },
    dayButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#DDD',
        borderRadius: 16,
        marginRight: 8,
        marginBottom: 8,
        backgroundColor: '#FFF',
    },
    selectedDayButton: {
        borderColor: '#2196F3',
        backgroundColor: '#E3F2FD',
    },
    dayButtonText: {
        fontSize: 14,
        color: '#333',
    },
    selectedDayButtonText: {
        color: '#2196F3',
        fontWeight: '600',
    },
    generateButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 24,
    },
    disabledButton: {
        backgroundColor: '#BDBDBD',
    },
    generateButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    clearToggleButton: {
        marginTop: 16,
        padding: 12,
        alignItems: 'center',
    },
    clearToggleText: {
        color: '#FF5722',
        fontSize: 14,
        fontWeight: '600',
    },
    clearContainer: {
        backgroundColor: '#FBE9E7',
        padding: 16,
        borderRadius: 8,
        marginTop: 8,
    },
    clearDescription: {
        fontSize: 14,
        color: '#D32F2F',
        marginBottom: 12,
    },
    clearButton: {
        backgroundColor: '#F44336',
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    clearButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    resultContainer: {
        marginTop: 24,
        padding: 16,
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
    },
    resultText: {
        fontSize: 14,
        color: '#2E7D32',
        marginBottom: 12,
    },
    hintText: {
        fontSize: 12,
        color: '#555',
        fontStyle: 'italic',
    },
});

export default TestDataGenerator;