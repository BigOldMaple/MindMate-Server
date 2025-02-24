// app/community/create_community/index.tsx
import { StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { communityApi } from '@/server/services/communityApi';
import type { CreateCommunityData } from '../../../server/types/community';

export default function CreateCommunityScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCommunityData>({
    name: '',
    description: '',
    type: '',
  });

  const isFormValid = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Community name is required');
      return false;
    }
    if (!formData.description.trim()) {
      Alert.alert('Error', 'Description is required');
      return false;
    }
    if (!formData.type) {
      Alert.alert('Error', 'Please select a community type');
      return false;
    }
    return true;
  };

  const handleCreateCommunity = async () => {
    if (!isFormValid()) return;

    try {
      setIsLoading(true);
      await communityApi.createCommunity(formData);
      
      Alert.alert(
        'Success',
        'Community created successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create community'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Community Name</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => setFormData({...formData, name: text})}
            placeholder="Enter community name"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({...formData, description: text})}
            placeholder="Describe your community"
            multiline
            numberOfLines={4}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Community Type</Text>
          <View style={styles.typeButtons}>
            <Pressable 
              style={[styles.typeButton, formData.type === 'support' && styles.selectedType]}
              onPress={() => setFormData({...formData, type: 'support'})}
              disabled={isLoading}
            >
              <Text style={[styles.typeText, formData.type === 'support' && styles.selectedTypeText]}>
                Support Group
              </Text>
            </Pressable>
            <Pressable 
              style={[styles.typeButton, formData.type === 'professional' && styles.selectedType]}
              onPress={() => setFormData({...formData, type: 'professional'})}
              disabled={isLoading}
            >
              <Text style={[styles.typeText, formData.type === 'professional' && styles.selectedTypeText]}>
                Professional
              </Text>
            </Pressable>
          </View>
        </View>

        <Pressable 
          style={[styles.createButton, isLoading && styles.createButtonDisabled]}
          onPress={handleCreateCommunity}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.createButtonText}>Create Community</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  content: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  input: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',
    alignItems: 'center',
  },
  selectedType: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  typeText: {
    color: '#666',
    fontSize: 16,
  },
  selectedTypeText: {
    color: 'white',
  },
  createButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});