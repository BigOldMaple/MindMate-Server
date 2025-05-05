// __tests__/messages-logic.test.ts - Fixed TypeScript errors

import { chatApi, ChatPreview } from '@/services/chatApi';
import { buddyPeerApi } from '@/services/buddyPeerApi';
import { communityApi } from '@/services/communityApi';
import { useAuth } from '@/contexts/AuthContext';

// Mock dependencies
jest.mock('@/services/chatApi', () => ({
    chatApi: {
        getConversations: jest.fn()
    },
    ChatPreview: class { }
}));

jest.mock('@/services/buddyPeerApi', () => ({
    buddyPeerApi: {
        getBuddyPeers: jest.fn()
    }
}));

jest.mock('@/services/communityApi', () => ({
    communityApi: {
        fetchAllCommunities: jest.fn(),
        getCommunityDetails: jest.fn()
    }
}));

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: jest.fn()
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn()
    })
}));

// Define interfaces for better type safety
interface MockCommunity {
    _id: string;
    name: string;
    isUserMember: boolean;
}

interface MockChatParticipant {
    id: string;
    name?: string;
    username?: string;
    isVerifiedProfessional?: boolean;
}

interface MockChat {
    id: string;
    participant: MockChatParticipant | null;
    type?: string;
    unreadCount?: number;
    lastMessage?: {
        content?: string;
        timestamp: Date;
    } | null;
    updatedAt?: Date;
}

describe('Messages Screen Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'currentUser' }
        });
    });

    // Helper function to simulate loading initial data
    const loadInitialData = async () => {
        try {
            const [chats, relationshipData] = await Promise.all([
                fetchChats(),
                fetchRelationshipData()
            ]);

            return {
                allChats: chats.chats,
                buddyPeerIds: relationshipData.buddyPeerIds,
                communityMemberIds: relationshipData.communityMemberIds,
                error: null
            };
        } catch (error) {
            return {
                allChats: [],
                buddyPeerIds: [],
                communityMemberIds: [],
                error: error instanceof Error ? error.message : 'Failed to load data'
            };
        }
    };

    // Helper to fetch chats
    const fetchChats = async () => {
        try {
            const conversations = await chatApi.getConversations();
            return { chats: conversations, error: null };
        } catch (err) {
            return {
                chats: [],
                error: err instanceof Error ? err.message : 'Failed to load chats'
            };
        }
    };

    // Helper to fetch relationship data
    const fetchRelationshipData = async () => {
        try {
            // Fetch buddy peers
            const buddyPeers = await buddyPeerApi.getBuddyPeers();
            const buddyPeerIds = buddyPeers.map(peer => peer.userId);

            // Fetch community members
            try {
                // Get communities the user is a member of
                const communities = await communityApi.fetchAllCommunities();
                const userCommunities = communities.filter(community => community.isUserMember);

                if (userCommunities.length === 0) {
                    return { buddyPeerIds, communityMemberIds: [], error: null };
                }

                const buddyPeerIdSet = new Set(buddyPeerIds);
                const communityMemberIds: string[] = [];

                // Process each community
                for (const community of userCommunities) {
                    if (!community._id) {
                        continue;
                    }

                    try {
                        const details = await communityApi.getCommunityDetails(community._id);

                        // Process each member
                        details.members.forEach(member => {
                            let memberId: string | undefined;

                            if (typeof member.userId === 'string') {
                                memberId = member.userId;
                            } else if (member.userId && typeof member.userId === 'object') {
                                const userIdObj = member.userId as { _id?: string | { toString(): string } };
                                memberId = userIdObj._id ?
                                    (typeof userIdObj._id === 'string' ? userIdObj._id : userIdObj._id.toString()) :
                                    undefined;
                            }

                            // Add if not current user and not already a buddy peer
                            if (memberId && memberId !== 'currentUser' && !buddyPeerIdSet.has(memberId)) {
                                communityMemberIds.push(memberId);
                            }
                        });
                    } catch (err) {
                        console.error(`Error fetching details for community:`, err);
                    }
                }

                return {
                    buddyPeerIds,
                    communityMemberIds: [...new Set(communityMemberIds)],
                    error: null
                };
            } catch (error) {
                return {
                    buddyPeerIds,
                    communityMemberIds: [],
                    error: error instanceof Error ? error.message : 'Failed to fetch community members'
                };
            }
        } catch (error) {
            return {
                buddyPeerIds: [],
                communityMemberIds: [],
                error: error instanceof Error ? error.message : 'Failed to fetch relationship data'
            };
        }
    };

    it('loads chats successfully', async () => {
        const mockChats: MockChat[] = [
            { id: 'chat1', participant: { id: 'user1' } },
            { id: 'chat2', participant: { id: 'user2' } }
        ];

        (chatApi.getConversations as jest.Mock).mockResolvedValueOnce(mockChats);

        const result = await fetchChats();

        expect(chatApi.getConversations).toHaveBeenCalled();
        expect(result.chats).toEqual(mockChats);
        expect(result.error).toBeNull();
    });

    it('handles errors when loading chats', async () => {
        const errorMessage = 'Network error';
        (chatApi.getConversations as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

        const result = await fetchChats();

        expect(result.chats).toEqual([]);
        expect(result.error).toBe(errorMessage);
    });

    it('loads relationship data successfully', async () => {
        // Setup mocks
        const mockBuddyPeers = [{ userId: 'buddy1' }, { userId: 'buddy2' }];
        const mockCommunities: MockCommunity[] = [
            { _id: 'comm1', name: 'Community 1', isUserMember: true },
            { _id: 'comm2', name: 'Community 2', isUserMember: false }
        ];
        const mockCommunityDetails = {
            _id: 'comm1',
            name: 'Community 1',
            members: [
                { userId: 'currentUser' },
                { userId: 'buddy1' }, // Already a buddy
                { userId: 'comm1' }, // New community member
                { userId: { _id: 'comm2' } } // Object format
            ]
        };

        (buddyPeerApi.getBuddyPeers as jest.Mock).mockResolvedValueOnce(mockBuddyPeers);
        (communityApi.fetchAllCommunities as jest.Mock).mockResolvedValueOnce(mockCommunities);
        (communityApi.getCommunityDetails as jest.Mock).mockResolvedValueOnce(mockCommunityDetails);

        const result = await fetchRelationshipData();

        expect(buddyPeerApi.getBuddyPeers).toHaveBeenCalled();
        expect(communityApi.fetchAllCommunities).toHaveBeenCalled();
        expect(communityApi.getCommunityDetails).toHaveBeenCalledWith('comm1');

        expect(result.buddyPeerIds).toEqual(['buddy1', 'buddy2']);
        expect(result.communityMemberIds).toEqual(['comm1', 'comm2']);
        expect(result.error).toBeNull();
    });

    it('handles empty community list', async () => {
        const mockBuddyPeers = [{ userId: 'buddy1' }];
        const mockCommunities: MockCommunity[] = [];

        (buddyPeerApi.getBuddyPeers as jest.Mock).mockResolvedValueOnce(mockBuddyPeers);
        (communityApi.fetchAllCommunities as jest.Mock).mockResolvedValueOnce(mockCommunities);

        const result = await fetchRelationshipData();

        expect(result.buddyPeerIds).toEqual(['buddy1']);
        expect(result.communityMemberIds).toEqual([]);
        expect(result.error).toBeNull();
    });

    // Helper function to categorize chats
    const categorizeChatsByRelationship = (
        chats: MockChat[],
        buddyPeerIds: string[],
        communityMemberIds: string[]
    ) => {
        const categorized = {
            buddyPeers: [] as MockChat[],
            community: [] as MockChat[],
            global: [] as MockChat[]
        };

        chats.forEach(chat => {
            const participantId = chat.participant?.id;

            if (!participantId) {
                return;
            }

            if (buddyPeerIds.includes(participantId)) {
                categorized.buddyPeers.push(chat);
            }
            else if (communityMemberIds.includes(participantId)) {
                categorized.community.push(chat);
            }
            else {
                categorized.global.push(chat);
            }
        });

        return categorized;
    };

    it('categorizes chats correctly', () => {
        const mockChats: MockChat[] = [
            { id: 'chat1', participant: { id: 'buddy1' }, type: 'direct', unreadCount: 0, lastMessage: null, updatedAt: new Date() },
            { id: 'chat2', participant: { id: 'comm1' }, type: 'direct', unreadCount: 0, lastMessage: null, updatedAt: new Date() },
            { id: 'chat3', participant: { id: 'random1' }, type: 'direct', unreadCount: 0, lastMessage: null, updatedAt: new Date() },
            { id: 'chat4', participant: { id: 'buddy2' }, type: 'direct', unreadCount: 0, lastMessage: null, updatedAt: new Date() },
            { id: 'chat5', participant: { id: 'comm2' }, type: 'direct', unreadCount: 0, lastMessage: null, updatedAt: new Date() },
            { id: 'chat6', participant: null, type: 'direct', unreadCount: 0, lastMessage: null, updatedAt: new Date() } // Invalid chat
        ];

        const buddyPeerIds = ['buddy1', 'buddy2'];
        const communityMemberIds = ['comm1', 'comm2'];

        const result = categorizeChatsByRelationship(mockChats, buddyPeerIds, communityMemberIds);

        expect(result.buddyPeers).toHaveLength(2);
        expect(result.community).toHaveLength(2);
        expect(result.global).toHaveLength(1);

        expect(result.buddyPeers[0].id).toBe('chat1');
        expect(result.buddyPeers[1].id).toBe('chat4');
        expect(result.community[0].id).toBe('chat2');
        expect(result.community[1].id).toBe('chat5');
        expect(result.global[0].id).toBe('chat3');
    });

    // Test timestamp formatting logic
    const formatTimestamp = (date: Date, nowDate: Date) => {
        // Get UTC dates to avoid timezone issues
        const nowYear = nowDate.getUTCFullYear();
        const nowMonth = nowDate.getUTCMonth();
        const nowDay = nowDate.getUTCDate();

        const dateYear = date.getUTCFullYear();
        const dateMonth = date.getUTCMonth();
        const dateDay = date.getUTCDate();

        // Same day
        if (dateYear === nowYear && dateMonth === nowMonth && dateDay === nowDay) {
            return "TIME_FORMAT"; // Return a constant for testing
        }
        // Yesterday
        else if (dateYear === nowYear && dateMonth === nowMonth && dateDay === nowDay - 1) {
            return "Yesterday";
        }
        // Within a week
        else if (
            (dateYear === nowYear && dateMonth === nowMonth && dateDay > nowDay - 7) ||
            (dateYear === nowYear && dateMonth === nowMonth - 1 && nowDay < 7 && dateDay > 30 + nowDay - 7)
        ) {
            return "WEEKDAY_FORMAT"; // Return a constant for testing
        }
        // Older
        else {
            return "MONTH_DAY_FORMAT"; // Return a constant for testing
        }
    };

    it('formats timestamps correctly', () => {
        // Use a fixed reference date for testing
        const nowDate = new Date('2023-05-15T12:00:00Z');

        // Same day
        const todayDate = new Date('2023-05-15T10:30:00Z');
        expect(formatTimestamp(todayDate, nowDate)).toBe("TIME_FORMAT");

        // Yesterday
        const yesterdayDate = new Date('2023-05-14T15:00:00Z');
        expect(formatTimestamp(yesterdayDate, nowDate)).toBe("Yesterday");

        // 3 days ago
        const recentDate = new Date('2023-05-12T15:00:00Z');
        expect(formatTimestamp(recentDate, nowDate)).toBe("WEEKDAY_FORMAT");

        // Older
        const olderDate = new Date('2023-05-01T15:00:00Z');
        expect(formatTimestamp(olderDate, nowDate)).toBe("MONTH_DAY_FORMAT");
    });
});