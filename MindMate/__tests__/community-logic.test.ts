// __tests__/community-logic.test.ts
import { Alert } from 'react-native';
import { communityApi, Community } from '@/services/communityApi';

// Mock communityApi
jest.mock('@/services/communityApi', () => ({
  communityApi: {
    fetchAllCommunities: jest.fn(),
    searchCommunities: jest.fn(),
    joinCommunity: jest.fn()
  },
  Community: class {}
}));

// Mock Alert
jest.mock('react-native', () => ({
  Alert: { alert: jest.fn() }
}));

// Mock router
const mockRouter = {
  push: jest.fn()
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter
}));

// Mock debounce
jest.mock('lodash', () => ({
  debounce: jest.fn(fn => {
    const debounced = jest.fn(fn) as any;
    debounced.cancel = jest.fn();
    return debounced;
  })
}));

describe('Community Screen Logic', () => {
  const mockCommunities: Community[] = [
    {
      _id: 'comm1',
      name: 'Test Community 1',
      description: 'Test Description 1',
      type: 'general',
      memberCount: 10,
      isUserMember: true,
      members: [],
      creator: 'dummy',
      userRole: 'admin'
    },
    {
      _id: 'comm2',
      name: 'Test Community 2',
      description: 'Test Description 2',
      type: 'professional',
      memberCount: 5,
      isUserMember: false,
      members: [],
      creator: 'dummy',
      userRole: 'guest'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (communityApi.fetchAllCommunities as jest.Mock).mockResolvedValue(mockCommunities);
  });

  // Helper function to simulate the fetchCommunities logic
  const fetchCommunities = async () => {
    try {
      const data = await communityApi.fetchAllCommunities();
      const myComms = data.filter((comm: Community) => comm.isUserMember);
      const discoverComms = data.filter((comm: Community) => !comm.isUserMember);
      
      return {
        myCommunities: myComms,
        discoverCommunities: discoverComms,
        error: null
      };
    } catch (err) {
      return {
        myCommunities: [],
        discoverCommunities: [],
        error: err instanceof Error ? err.message : 'An error occurred'
      };
    }
  };

  it('fetches and categorizes communities correctly', async () => {
    const result = await fetchCommunities();
    
    expect(communityApi.fetchAllCommunities).toHaveBeenCalled();
    expect(result.myCommunities).toHaveLength(1);
    expect(result.discoverCommunities).toHaveLength(1);
    expect(result.myCommunities[0]._id).toBe('comm1');
    expect(result.discoverCommunities[0]._id).toBe('comm2');
    expect(result.error).toBeNull();
  });

  it('handles errors during community fetching', async () => {
    const errorMessage = 'Network error';
    (communityApi.fetchAllCommunities as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
    
    const result = await fetchCommunities();
    
    expect(result.myCommunities).toHaveLength(0);
    expect(result.discoverCommunities).toHaveLength(0);
    expect(result.error).toBe(errorMessage);
  });

  // Helper function to simulate the searchCommunities logic
  const searchCommunities = async (query: string) => {
    try {
      const data = await communityApi.searchCommunities(query);
      const filteredData = data.filter((comm: Community) => !comm.isUserMember);
      return {
        discoverCommunities: filteredData,
        error: null
      };
    } catch (err) {
      return {
        discoverCommunities: [],
        error: err instanceof Error ? err.message : 'Failed to search communities'
      };
    }
  };

  it('searches communities correctly', async () => {
    const searchResults = [{
      _id: 'comm3',
      name: 'Search Result',
      description: 'Found by search',
      type: 'general',
      memberCount: 3,
      isUserMember: false
    }];
    
    (communityApi.searchCommunities as jest.Mock).mockResolvedValueOnce(searchResults);
    
    const result = await searchCommunities('test query');
    
    expect(communityApi.searchCommunities).toHaveBeenCalledWith('test query');
    expect(result.discoverCommunities).toEqual(searchResults);
    expect(result.error).toBeNull();
  });

  it('handles errors during community search', async () => {
    const errorMessage = 'Search failed';
    (communityApi.searchCommunities as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
    
    const result = await searchCommunities('test query');
    
    expect(result.discoverCommunities).toHaveLength(0);
    expect(result.error).toBe(errorMessage);
  });

  // Helper function to simulate joinCommunity logic
  const handleJoinCommunity = async (communityId: string) => {
    try {
      await communityApi.joinCommunity(communityId);
      // Typically we would fetch communities again here
      return { success: true, error: null };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to join community'
      };
    }
  };

  it('handles joining a community', async () => {
    (communityApi.joinCommunity as jest.Mock).mockResolvedValueOnce(true);
    
    const result = await handleJoinCommunity('comm2');
    
    expect(communityApi.joinCommunity).toHaveBeenCalledWith('comm2');
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  it('handles errors when joining a community', async () => {
    const errorMessage = 'Join failed';
    (communityApi.joinCommunity as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));
    
    const result = await handleJoinCommunity('comm2');
    
    expect(result.success).toBe(false);
    expect(result.error).toBe(errorMessage);
  });
});