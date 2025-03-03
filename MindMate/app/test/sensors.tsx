// Simplified section in your test/sensors.tsx
import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { stepService } from '@/services/simplifiedStepService';

// Inside your component:
const [steps, setSteps] = useState(0);

// In useEffect:
useEffect(() => {
  let isMounted = true;
  let intervalId: NodeJS.Timeout | null = null;
  
  const setupStepTracking = async () => {
    const available = await stepService.setup();
    if (available) {
      const hasPermission = await stepService.requestPermission();
      if (hasPermission) {
        // Initial fetch
        const todaySteps = await stepService.getTodaySteps();
        if (isMounted) setSteps(todaySteps);
        
        // Update every minute when screen is visible
        intervalId = setInterval(async () => {
          const updatedSteps = await stepService.getTodaySteps();
          if (isMounted) setSteps(updatedSteps);
        }, 60000);
      }
    }
  };
  
  setupStepTracking();
  
  return () => {
    isMounted = false;
    if (intervalId) clearInterval(intervalId);
  };
}, []);

// In your render:
<Text>Today's Steps: {steps}</Text>
