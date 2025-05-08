// Temporary app/_layout.jsx replacement
import React from 'react';
import { Text, View } from 'react-native';

export default function App() {
  console.log('Basic app loading');
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Basic Test App</Text>
    </View>
  );
}