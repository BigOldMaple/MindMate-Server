// services/__tests__/buddyPeerApi.test.ts

// Set up mocks before importing modules
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
}));

import * as SecureStore from 'expo-secure-store';
import {
    buddyPeerApi,
    BuddyPeer,
    BuddyPeerProfile,
    BuddyPeerRequest
} from '../buddyPeerApi';

// Create mock for global fetch
global.fetch = jest.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
    })
) as jest.Mock;

describe('Buddy Peer API Service', () => {
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Reset the SecureStore state
        (SecureStore as any)._reset();

        // Set up a token for auth
        SecureStore.setItemAsync('userToken', 'test-token');

        // Reset fetch mock to a default implementation
        (global.fetch as jest.Mock).mockReset().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true })
            })
        );
    });

    describe('searchUsers', () => {
        it('returns matching users array', async () => {
            // Arrange
            const query = 'test';
            const mockUsers = [
                { id: 'user1', username: 'testuser', name: 'Test User' },
                { id: 'user2', username: 'tester', name: 'Tester McTest' }
            ];

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockUsers)
                })
            );

            // Act
            const result = await buddyPeerApi.searchUsers(query);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                `http://test-api.com/api/buddy-peer/search?query=${encodeURIComponent(query)}`,
                { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
            );
            expect(result).toEqual(mockUsers);
        });

        it('handles errors when searching users', async () => {
            // Arrange
            const query = 'test';

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Search failed' })
                })
            );

            // Act & Assert
            // Updated to match the actual fallback error message
            await expect(buddyPeerApi.searchUsers(query)).rejects.toThrow('Failed to search users');
        });
    });

    describe('sendBuddyRequest', () => {
        it('sends request to the specified username', async () => {
            // Arrange
            const username = 'testuser';

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                })
            );

            // Act
            await buddyPeerApi.sendBuddyRequest(username);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                'http://test-api.com/api/buddy-peer/request',
                {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                }
            );
        });

        it('handles errors when sending buddy request', async () => {
            // Arrange
            const username = 'nonexistent';

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({ error: 'User not found' })
                })
            );

            // Act & Assert
            // Updated to match the actual fallback error message
            await expect(buddyPeerApi.sendBuddyRequest(username)).rejects.toThrow('Failed to send buddy request');
        });
    });

    describe('getPendingRequests', () => {
        it('returns array of pending buddy requests', async () => {
            // Arrange
            const mockRequests: BuddyPeerRequest[] = [
                {
                    _id: 'req1',
                    senderId: 'user1',
                    recipientId: 'currentuser',
                    status: 'pending',
                    createdAt: '2025-04-01T12:00:00.000Z',
                    sender: {
                        username: 'user1',
                        profile: {
                            name: 'User One'
                        }
                    }
                },
                {
                    _id: 'req2',
                    senderId: 'currentuser',
                    recipientId: 'user2',
                    status: 'pending',
                    createdAt: '2025-04-02T10:00:00.000Z',
                    recipient: {
                        username: 'user2',
                        profile: {
                            name: 'User Two'
                        }
                    }
                }
            ];

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockRequests)
                })
            );

            // Act
            const result = await buddyPeerApi.getPendingRequests();

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                'http://test-api.com/api/buddy-peer/requests',
                { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
            );
            expect(result).toEqual(mockRequests);
        });

        it('handles errors when fetching pending requests', async () => {
            // Arrange

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Failed to fetch requests' })
                })
            );

            // Act & Assert
            // Updated to match the actual fallback error message
            await expect(buddyPeerApi.getPendingRequests()).rejects.toThrow('Failed to fetch pending requests');
        });
    });

    describe('respondToRequest', () => {
        it('responds to request with accept=true', async () => {
            // Arrange
            const requestId = 'req1';
            const accept = true;

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                })
            );

            // Act
            await buddyPeerApi.respondToRequest(requestId, accept);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                `http://test-api.com/api/buddy-peer/request/${requestId}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accept })
                }
            );
        });

        it('responds to request with accept=false', async () => {
            // Arrange
            const requestId = 'req1';
            const accept = false;

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                })
            );

            // Act
            await buddyPeerApi.respondToRequest(requestId, accept);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                `http://test-api.com/api/buddy-peer/request/${requestId}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accept })
                }
            );
        });

        it('handles errors when responding to request', async () => {
            // Arrange
            const requestId = 'invalid-req';
            const accept = true;

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({ error: 'Request not found' })
                })
            );

            // Act & Assert
            // Updated to match the actual error message
            await expect(buddyPeerApi.respondToRequest(requestId, accept))
                .rejects.toThrow('Failed to respond to buddy request');
        });
    });

    describe('getBuddyPeers', () => {
        it('returns array of buddy peers', async () => {
            // Arrange
            const mockBuddies: BuddyPeer[] = [
                {
                    userId: 'user1',
                    username: 'buddy1',
                    name: 'Buddy One',
                    relationship: 'friend',
                    dateAdded: '2025-03-15T10:00:00.000Z'
                },
                {
                    userId: 'user2',
                    username: 'buddy2',
                    name: 'Buddy Two',
                    relationship: 'colleague',
                    dateAdded: '2025-03-20T14:30:00.000Z'
                }
            ];

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockBuddies)
                })
            );

            // Act
            const result = await buddyPeerApi.getBuddyPeers();

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                'http://test-api.com/api/buddy-peer',
                { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
            );
            expect(result).toEqual(mockBuddies);
        });

        it('handles errors when fetching buddy peers', async () => {
            // Arrange

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Failed to fetch buddy peers' })
                })
            );

            // Act & Assert
            await expect(buddyPeerApi.getBuddyPeers()).rejects.toThrow('Failed to fetch buddy peers');
        });
    });

    describe('removeBuddyPeer', () => {
        it('removes the specified buddy peer', async () => {
            // Arrange
            const userId = 'user1';

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                })
            );

            // Act
            await buddyPeerApi.removeBuddyPeer(userId);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                `http://test-api.com/api/buddy-peer/${userId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
                }
            );
        });

        it('handles errors when removing buddy peer', async () => {
            // Arrange
            const userId = 'invalid-user';

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({ error: 'Buddy peer not found' })
                })
            );

            // Act & Assert
            // Updated to match the actual fallback error message
            await expect(buddyPeerApi.removeBuddyPeer(userId)).rejects.toThrow('Failed to remove buddy peer');
        });
    });

    describe('getBuddyProfile', () => {
        it('fetches buddy profile for specified user', async () => {
            // Arrange
            const userId = 'user1';
            const mockProfile: BuddyPeerProfile = {
                userId: 'user1',
                username: 'buddy1',
                name: 'Buddy One',
                relationship: 'friend',
                dateAdded: '2025-03-15T10:00:00.000Z',
                profile: {
                    isVerifiedProfessional: true,
                    joinDate: '2024-12-01T00:00:00.000Z',
                    organizationAffiliation: 'Health Services'
                },
                stats: {
                    checkIns: 45,
                    sessions: 12,
                    responseRate: 0.92
                }
            };

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockProfile)
                })
            );

            // Act
            const result = await buddyPeerApi.getBuddyProfile(userId);

            // Assert
            expect(global.fetch).toHaveBeenCalledWith(
                `http://test-api.com/api/buddy-peer/${userId}/profile`,
                { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
            );
            expect(result).toEqual(mockProfile);
        });

        it('handles errors when fetching buddy profile', async () => {
            // Arrange
            const userId = 'invalid-user';

            (global.fetch as jest.Mock).mockImplementationOnce(() =>
                Promise.resolve({
                    ok: false,
                    status: 404,
                    json: () => Promise.resolve({ error: 'Buddy profile not found' })
                })
            );

            // Act & Assert
            // Updated to match the actual fallback error message
            await expect(buddyPeerApi.getBuddyProfile(userId)).rejects.toThrow('Failed to fetch buddy profile');
        });
    });
});