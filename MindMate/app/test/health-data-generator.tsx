// MindMate/app/test/health-data-generator.tsx
import React from 'react';
import { View } from '@/components/Themed';
import { Stack } from 'expo-router';
import TestDataGenerator from '@/components/TestDataGenerator';

export default function HealthDataGeneratorScreen() {
  return (
    <>
      <Stack.Screen 
        options={{
          title: 'Health Data Test Generator',
          headerShown: true,
        }} 
      />
      <View style={{ flex: 1, backgroundColor: '#F5F6FA' }}>
        <TestDataGenerator />
      </View>
    </>
  );
}