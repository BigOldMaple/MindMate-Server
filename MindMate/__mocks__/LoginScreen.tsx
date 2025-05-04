// __mocks__/LoginScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { auth } from '@/services/auth';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }
    
    try {
      await auth.login({ email, password });
    } catch (error) {
      Alert.alert('Login Failed', 'Invalid email or password');
    }
  };
  
  return (
    <View>
      <TextInput 
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput 
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable onPress={handleLogin}>
        <Text>Log In</Text>
      </Pressable>
    </View>
  );
};

export default LoginScreen;