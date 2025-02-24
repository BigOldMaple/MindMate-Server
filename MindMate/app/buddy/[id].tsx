// app/buddy/[id].tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { View, Text } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { buddyPeerApi } from '@/server/services/buddyPeerApi';

interface BuddyProfile {
    userId: string;
    username: string;
    name: string;
    profile: {
        isVerifiedProfessional: boolean;
        joinDate: string;
    };
    relationship: string;
    stats?: {
        checkIns: number;
        sessions: number;
        responseRate: number;
    };
}

export default function BuddyProfileScreen() {
    const { id } = useLocalSearchParams();
    const [profile, setProfile] = useState<BuddyProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const router = useRouter();

    useEffect(() => {
        fetchBuddyProfile();
    }, [id]);

    const fetchBuddyProfile = async () => {
        try {
            setIsLoading(true);
            const buddyProfile = await buddyPeerApi.getBuddyProfile(id as string);
            setProfile(buddyProfile);
        } catch (error) {
            Alert.alert('Error', 'Failed to load buddy profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveBuddy = async () => {
        if (!profile) return;

        Alert.alert(
            'Remove Buddy',
            'Are you sure you want to remove this buddy from your support network?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await buddyPeerApi.removeBuddyPeer(profile.userId);
                            Alert.alert('Success', 'Buddy removed from your support network');
                            router.back();
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

    if (!profile) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Failed to load buddy profile</Text>
                <Pressable style={styles.retryButton} onPress={fetchBuddyProfile}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <FontAwesome name="arrow-left" size={20} color="#666" />
                    </Pressable>
                    <View style={styles.headerContent}>
                        <Text style={styles.headerTitle}>Buddy Profile</Text>
                    </View>
                    <Pressable style={styles.menuButton} onPress={handleRemoveBuddy}>
                        <FontAwesome name="trash" size={20} color="#FF3B30" />
                    </Pressable>
                </View>

                {/* Profile Header */}
                <View style={styles.profileHeader}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatar}>
                            <FontAwesome name="user" size={40} color="#666" />
                        </View>
                    </View>
                    <Text style={styles.name}>{profile.name}</Text>
                    <Text style={styles.username}>@{profile.username}</Text>
                    {profile.profile.isVerifiedProfessional && (
                        <View style={styles.verifiedBadge}>
                            <FontAwesome name="check-circle" size={12} color="#2196F3" />
                            <Text style={styles.verifiedText}>Professional</Text>
                        </View>
                    )}
                </View>

                {/* Tabs */}
                <View style={styles.tabsContainer}>
                    <Pressable
                        style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
                        onPress={() => setActiveTab('overview')}
                    >
                        <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
                            Overview
                        </Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tab, activeTab === 'history' && styles.activeTab]}
                        onPress={() => setActiveTab('history')}
                    >
                        <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
                            History
                        </Text>
                    </Pressable>
                </View>

                <ScrollView style={styles.content}>
                    {activeTab === 'overview' ? (
                        <View style={styles.section}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Relationship</Text>
                                <Text style={styles.infoValue}>{profile.relationship}</Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Buddy Since</Text>
                                <Text style={styles.infoValue}>
                                    {new Date(profile.profile.joinDate).toLocaleDateString()}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.section}>
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>
                                    Interaction history will be available soon
                                </Text>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F6FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        fontSize: 16,
        color: '#666',
        marginBottom: 16,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: '#2196F3',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerContent: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    menuButton: {
        padding: 8,
    },
    profileHeader: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#F5F6FA',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EEE',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    username: {
        fontSize: 16,
        color: '#666',
        marginBottom: 8,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginTop: 8,
    },
    verifiedText: {
        fontSize: 12,
        color: '#2196F3',
        marginLeft: 4,
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
    },
    section: {
        backgroundColor: 'white',
        marginTop: 16,
        padding: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    infoLabel: {
        fontSize: 14,
        color: '#666',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '500',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 24,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2196F3',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#666',
    },
    emptyState: {
        padding: 32,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
});