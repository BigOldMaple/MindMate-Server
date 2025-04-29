// app/(tabs)/messages/new.tsx
import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, Stack } from 'expo-router'; // Add Stack import
import { buddyPeerApi } from '@/services/buddyPeerApi';
import { chatApi } from '@/services/chatApi';
import { debounce } from 'lodash';

interface SearchResult {
  id: string;
  username: string;
  name: string;
}

export default function NewMessageScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const searchUsers = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      try {
        const results = await buddyPeerApi.searchUsers(query);
        setSearchResults(results);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search users');
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    if (searchQuery) {
      setIsSearching(true);
      searchUsers(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchUsers]);

  const handleUserSelect = async (userId: string) => {
    try {
      // Create or get existing conversation
      const conversationId = await chatApi.createConversation(userId);
      // Navigate to chat screen (to be implemented)
      console.log('Created conversation:', conversationId);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    }
  };

  return (
    <>
      {/* Hide default header */}
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              opacity: pressed ? 0.5 : 1,
              padding: 8,
            })}
          >
            <FontAwesome name="arrow-left" size={20} color="#666" />
          </Pressable>
          <Text style={styles.headerTitle}>New Message</Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <FontAwesome name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
          />
          {isSearching && (
            <ActivityIndicator size="small" color="#2196F3" style={styles.loader} />
          )}
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Search Results */}
        <View style={styles.resultsContainer}>
          {searchResults.length === 0 && searchQuery && !isSearching ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No users found</Text>
            </View>
          ) : (
            searchResults.map((user) => (
              <Pressable
                key={user.id}
                style={styles.userCard}
                onPress={() => handleUserSelect(user.id)}
              >
                <View style={styles.avatar}>
                  <FontAwesome name="user" size={24} color="#666" />
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userUsername}>@{user.username}</Text>
                </View>
                <FontAwesome 
                  name="chevron-right" 
                  size={16} 
                  color="#666"
                  style={styles.chevron}
                />
              </Pressable>
            ))
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    margin: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    padding: 0,
  },
  loader: {
    marginLeft: 12,
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  resultsContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F6FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
  },
  chevron: {
    marginLeft: 8,
  },
});