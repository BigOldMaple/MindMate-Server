// services/__tests__/communityApi.test.ts

// Set up mocks before importing modules
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { communityApi, Community, CreateCommunityPayload } from '../communityApi';
  
  // Create mock for global fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  ) as jest.Mock;
  
  describe('Community API Service', () => {
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
  
    describe('fetchAllCommunities', () => {
      it('returns array of communities', async () => {
        // Arrange
        const mockCommunities: Community[] = [
          {
            _id: 'comm1',
            name: 'Test Community 1',
            description: 'A test community',
            type: 'support',
            members: [],
            creator: 'user1',
            memberCount: 1,
            isUserMember: false,
            userRole: null
          },
          {
            _id: 'comm2',
            name: 'Test Community 2',
            description: 'Another test community',
            type: 'professional',
            members: [],
            creator: 'user2',
            memberCount: 5,
            isUserMember: true,
            userRole: 'member'
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCommunities)
          })
        );
  
        // Act
        const result = await communityApi.fetchAllCommunities();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/community',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockCommunities);
      });
  
      it('handles errors when fetching communities', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(communityApi.fetchAllCommunities()).rejects.toThrow('Server error');
      });
    });
  
    describe('searchCommunities', () => {
      it('returns matching communities based on query', async () => {
        // Arrange
        const query = 'test';
        const mockCommunities: Community[] = [
          {
            _id: 'comm1',
            name: 'Test Community',
            description: 'A test community',
            type: 'support',
            members: [],
            creator: 'user1',
            memberCount: 1,
            isUserMember: false,
            userRole: null
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCommunities)
          })
        );
  
        // Act
        const result = await communityApi.searchCommunities(query);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/community/search?query=${encodeURIComponent(query)}`,
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockCommunities);
      });
  
      it('handles errors when searching communities', async () => {
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
        await expect(communityApi.searchCommunities(query)).rejects.toThrow('Search failed');
      });
    });
  
    describe('getCommunityDetails', () => {
      it('fetches community details for specified ID', async () => {
        // Arrange
        const communityId = 'comm1';
        const mockCommunity: Community = {
          _id: communityId,
          name: 'Test Community',
          description: 'A test community',
          type: 'support',
          members: [
            {
              userId: 'user1',
              role: 'admin',
              joinDate: '2025-04-01T10:00:00.000Z'
            },
            {
              userId: 'user2',
              role: 'member',
              joinDate: '2025-04-02T15:30:00.000Z'
            }
          ],
          creator: 'user1',
          memberCount: 2,
          isUserMember: true,
          userRole: 'member',
          creatorDetails: {
            username: 'creator',
            profile: {
              name: 'Community Creator',
              isVerifiedProfessional: false
            }
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockCommunity)
          })
        );
  
        // Act
        const result = await communityApi.getCommunityDetails(communityId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/community/${communityId}`,
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockCommunity);
      });
  
      it('handles errors when fetching community details', async () => {
        // Arrange
        const communityId = 'invalid-id';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Community not found' })
          })
        );
  
        // Act & Assert
        await expect(communityApi.getCommunityDetails(communityId)).rejects.toThrow('Failed to fetch community details');
      });
    });
  
    describe('joinCommunity', () => {
      it('sends request to join community', async () => {
        // Arrange
        const communityId = 'comm1';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await communityApi.joinCommunity(communityId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/community/${communityId}/join`,
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when joining community', async () => {
        // Arrange
        const communityId = 'comm1';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: 'Already a member' })
          })
        );
  
        // Act & Assert
        await expect(communityApi.joinCommunity(communityId)).rejects.toThrow('Already a member');
      });
    });
  
    describe('leaveCommunity', () => {
      it('sends request to leave community', async () => {
        // Arrange
        const communityId = 'comm1';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          })
        );
  
        // Act
        await communityApi.leaveCommunity(communityId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/community/${communityId}/leave`,
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
      });
  
      it('handles errors when leaving community', async () => {
        // Arrange
        const communityId = 'comm1';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: 'Not a member' })
          })
        );
  
        // Act & Assert
        await expect(communityApi.leaveCommunity(communityId)).rejects.toThrow('Not a member');
      });
    });
  
    describe('createCommunity', () => {
      it('creates a new community', async () => {
        // Arrange
        const newCommunity: CreateCommunityPayload = {
          name: 'New Community',
          description: 'A community created through API',
          type: 'support'
        };
        
        const createdCommunity: Community = {
          _id: 'new-comm-123',
          name: newCommunity.name,
          description: newCommunity.description,
          type: newCommunity.type,
          members: [{
            userId: 'current-user',
            role: 'admin',
            joinDate: new Date().toISOString()
          }],
          creator: 'current-user',
          memberCount: 1,
          isUserMember: true,
          userRole: 'admin'
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(createdCommunity)
          })
        );
  
        // Act
        const result = await communityApi.createCommunity(newCommunity);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/community',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(newCommunity)
          }
        );
        expect(result).toEqual(createdCommunity);
      });
  
      it('handles errors when creating community', async () => {
        // Arrange
        const newCommunity: CreateCommunityPayload = {
          name: 'New Community',
          description: 'A community created through API',
          type: 'invalid-type' // This should cause an error
        };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: 'Invalid community type' })
          })
        );
  
        // Act & Assert
        await expect(communityApi.createCommunity(newCommunity)).rejects.toThrow('Invalid community type');
      });
    });
  });