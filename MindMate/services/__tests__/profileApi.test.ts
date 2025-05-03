// services/__tests__/profileApi.test.ts

// Set up mocks before importing modules
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { profileApi, UserProfile, EmergencyContact } from '../profileApi';
  
  // Create mock for global fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  ) as jest.Mock;
  
  describe('Profile API Service', () => {
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
  
    describe('getProfile', () => {
      it('fetches user profile with valid auth token', async () => {
        // Arrange
        const mockProfile: UserProfile = {
          _id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          phone: '+1234567890',
          profile: {
            name: 'Test User',
            isVerifiedProfessional: false
          },
          emergencyContact: {
            name: 'Emergency Contact',
            relationship: 'Family',
            phone: '+0987654321'
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProfile)
          })
        );
  
        // Act
        const result = await profileApi.getProfile();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/profile',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockProfile);
      });
  
      it('handles authentication errors', async () => {
        // Arrange - no auth token
        await SecureStore.deleteItemAsync('userToken');
  
        // Act & Assert
        await expect(profileApi.getProfile()).rejects.toThrow('Authentication required');
        expect(global.fetch).not.toHaveBeenCalled();
      });
  
      it('handles API errors', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(profileApi.getProfile()).rejects.toThrow('Failed to fetch profile');
        expect(global.fetch).toHaveBeenCalled();
      });
  
      it('handles network failures', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.reject(new Error('Network error'))
        );
  
        // Act & Assert
        await expect(profileApi.getProfile()).rejects.toThrow();
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  
    describe('updateProfile', () => {
      it('updates profile with valid data', async () => {
        // Arrange
        const updateData = {
          username: 'newusername',
          phone: '+9876543210'
        };
        
        const mockUpdatedProfile: UserProfile = {
          _id: 'user123',
          username: 'newusername',
          email: 'test@example.com',
          phone: '+9876543210',
          profile: {
            name: 'Test User',
            isVerifiedProfessional: false
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockUpdatedProfile)
          })
        );
  
        // Act
        const result = await profileApi.updateProfile(updateData);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/profile',
          {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          }
        );
        expect(result).toEqual(mockUpdatedProfile);
      });
  
      it('updates emergency contact', async () => {
        // Arrange
        const emergencyContact: EmergencyContact = {
          name: 'New Emergency Contact',
          relationship: 'Friend',
          phone: '+1122334455'
        };
        
        const updateData = { emergencyContact };
        
        const mockUpdatedProfile: UserProfile = {
          _id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          profile: {
            name: 'Test User',
            isVerifiedProfessional: false
          },
          emergencyContact
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockUpdatedProfile)
          })
        );
  
        // Act
        const result = await profileApi.updateProfile(updateData);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/profile',
          {
            method: 'PATCH',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          }
        );
        expect(result).toEqual(mockUpdatedProfile);
        expect(result.emergencyContact).toEqual(emergencyContact);
      });
  
      it('handles authentication errors', async () => {
        // Arrange - no auth token
        await SecureStore.deleteItemAsync('userToken');
        const updateData = { username: 'newusername' };
  
        // Act & Assert
        await expect(profileApi.updateProfile(updateData)).rejects.toThrow('Authentication required');
        expect(global.fetch).not.toHaveBeenCalled();
      });
  
      it('handles API errors', async () => {
        // Arrange
        const updateData = { username: 'invalidusername' };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: 'Invalid username' })
          })
        );
  
        // Act & Assert
        await expect(profileApi.updateProfile(updateData)).rejects.toThrow('Failed to update profile');
        expect(global.fetch).toHaveBeenCalled();
      });
  
      it('handles network failures', async () => {
        // Arrange
        const updateData = { username: 'newusername' };
        
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.reject(new Error('Network error'))
        );
  
        // Act & Assert
        await expect(profileApi.updateProfile(updateData)).rejects.toThrow();
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });