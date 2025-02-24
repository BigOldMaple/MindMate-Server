
import { StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, Modal } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useState, useEffect, useCallback } from 'react';
import { buddyPeerApi, BuddyPeer, BuddyPeerRequest } from '../../../services/buddyPeerApi';
import { debounce } from 'lodash';
import { Stack, useRouter } from 'expo-router';
import React from 'react';

export default function SupportNetworkScreen() {
    const [activeTab, setActiveTab] = useState<'buddies' | 'requests'>('buddies');
    const [isLoading, setIsLoading] = useState(true);
    const [buddyPeers, setBuddyPeers] = useState<BuddyPeer[]>([]);
    const [pendingRequests, setPendingRequests] = useState<BuddyPeerRequest[]>([]);
    const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; name: string }>>([]);
    const [isSearching, setIsSearching] = useState(false);
    const router = useRouter();

    const fetchBuddyPeers = async () => {
        try {
            const peers = await buddyPeerApi.getBuddyPeers();
            setBuddyPeers(peers);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch buddy peers');
        }
    };

    const fetchPendingRequests = async () => {
        try {
            const requests = await buddyPeerApi.getPendingRequests();
            setPendingRequests(requests);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch pending requests');
        }
    };

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
            } catch (error) {
                Alert.alert('Error', 'Failed to search users');
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

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                await Promise.all([fetchBuddyPeers(), fetchPendingRequests()]);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    const handleSendRequest = async (username: string) => {
        try {
            await buddyPeerApi.sendBuddyRequest(username);
            Alert.alert('Success', 'Buddy request sent successfully');
            setIsSearchModalVisible(false);
            setSearchQuery('');
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send request');
        }
    };

    const handleRespondToRequest = async (requestId: string, accept: boolean) => {
        try {
            await buddyPeerApi.respondToRequest(requestId, accept);
            Alert.alert(
                'Success',
                `Request ${accept ? 'accepted' : 'declined'} successfully`
            );
            await Promise.all([fetchBuddyPeers(), fetchPendingRequests()]);
        } catch (error) {
            Alert.alert('Error', 'Failed to respond to request');
        }
    };

    const handleRemoveBuddy = async (userId: string) => {
        Alert.alert(
            'Remove Buddy',
            'Are you sure you want to remove this buddy?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await buddyPeerApi.removeBuddyPeer(userId);
                            await fetchBuddyPeers();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to remove buddy');
                        }
                    }
                }
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <FontAwesome name="arrow-left" size={20} color="#666" />
                    </Pressable>
                    <Text style={styles.title}>Support Network</Text>
                    <Pressable
                        style={styles.addButton}
                        onPress={() => setIsSearchModalVisible(true)}
                    >
                        <FontAwesome name="plus" size={20} color="white" />
                    </Pressable>
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <Pressable
                        style={[styles.tab, activeTab === 'buddies' && styles.activeTab]}
                        onPress={() => setActiveTab('buddies')}
                    >
                        <Text style={[styles.tabText, activeTab === 'buddies' && styles.activeTabText]}>
                            My Buddies
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
                        onPress={() => setActiveTab('requests')}
                    >
                        <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>
                            Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
                        </Text>
                    </Pressable>
                </View>

                <ScrollView style={styles.content}>
                    {activeTab === 'buddies' ? (
                        buddyPeers.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>
                                    You haven't added any buddy peers yet
                                </Text>
                            </View>
                        ) : (
                            buddyPeers.map((buddy) => (
                                <Pressable 
                                    key={buddy.userId} 
                                    style={styles.buddyCard}
                                    onPress={() => router.push(`../buddy/${buddy.userId}`)}
                                >
                                    <View style={styles.buddyInfo}>
                                        <Text style={styles.buddyName}>{buddy.name}</Text>
                                        <Text style={styles.buddyUsername}>@{buddy.username}</Text>
                                    </View>
                                    <Pressable
                                        style={styles.removeButton}
                                        onPress={(e) => {
                                            e.stopPropagation(); // Prevent triggering the parent onPress
                                            handleRemoveBuddy(buddy.userId);
                                        }}
                                    >
                                        <FontAwesome name="times" size={20} color="#FF3B30" />
                                    </Pressable>
                                </Pressable>
                            ))
                        )
                    ) : (
                        pendingRequests.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>
                                    No pending buddy requests
                                </Text>
                            </View>
                        ) : (
                            pendingRequests.map((request) => (
                                <View key={request._id} style={styles.requestCard}>
                                    <View style={styles.requestInfo}>
                                        <Text style={styles.requestName}>
                                            {request.sender?.profile.name}
                                        </Text>
                                        <Text style={styles.requestUsername}>
                                            @{request.sender?.username}
                                        </Text>
                                    </View>
                                    <View style={styles.requestActions}>
                                        <Pressable
                                            style={[styles.actionButton, styles.acceptButton]}
                                            onPress={() => handleRespondToRequest(request._id, true)}
                                        >
                                            <Text style={styles.actionButtonText}>Accept</Text>
                                        </Pressable>
                                        <Pressable
                                            style={[styles.actionButton, styles.declineButton]}
                                            onPress={() => handleRespondToRequest(request._id, false)}
                                        >
                                            <Text style={[styles.actionButtonText, styles.declineButtonText]}>
                                                Decline
                                            </Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        )
                    )}
                </ScrollView>

                {/* Search Modal */}
                <Modal
                    visible={isSearchModalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setIsSearchModalVisible(false)}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Add Buddy</Text>
                                <Pressable
                                    style={styles.closeButton}
                                    onPress={() => {
                                        setIsSearchModalVisible(false);
                                        setSearchQuery('');
                                    }}
                                >
                                    <FontAwesome name="times" size={20} color="#666" />
                                </Pressable>
                            </View>

                            <View style={styles.searchContainer}>
                                <FontAwesome name="search" size={20} color="#666" />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search by username..."
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                />
                                {isSearching && (
                                    <ActivityIndicator size="small" color="#2196F3" />
                                )}
                            </View>

                            <ScrollView style={styles.searchResults}>
                                {searchResults.map((result) => (
                                    <Pressable
                                        key={result.id}
                                        style={styles.searchResultItem}
                                        onPress={() => handleSendRequest(result.username)}
                                    >
                                        <View>
                                            <Text style={styles.searchResultName}>{result.name}</Text>
                                            <Text style={styles.searchResultUsername}>
                                                @{result.username}
                                            </Text>
                                        </View>
                                        <FontAwesome name="plus" size={20} color="#2196F3" />
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
    },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2196F3',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: 'white',
        padding: 8,
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
        backgroundColor: '#F5F6FA',
    },
    activeTab: {
        backgroundColor: '#2196F3',
    },
    tabText: {
        fontSize: 14,
        color: '#666',
    },
    activeTabText: {
        color: 'white',
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 16,
    },
    buddyCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    buddyInfo: {
        flex: 1,
    },
    buddyName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    buddyUsername: {
        fontSize: 14,
        color: '#666',
    },
    removeButton: {
        padding: 8,
    },
    requestCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    requestInfo: {
        marginBottom: 12,
    },
    requestName: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    requestUsername: {
        fontSize: 14,
        color: '#666',
    },
    requestActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptButton: {
        backgroundColor: '#2196F3',
    },
    declineButton: {
        backgroundColor: '#F5F6FA',
        borderWidth: 1,
        borderColor: '#FF3B30',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    declineButtonText: {
        color: '#FF3B30',
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
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        minHeight: '50%',
        padding: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F6FA',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
    },
    searchResults: {
        flex: 1,
    },
    searchResultItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    searchResultName: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    searchResultUsername: {
        fontSize: 14,
        color: '#666',
    },
});