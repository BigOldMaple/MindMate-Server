// services/__tests__/auth.test.ts

// Add TypeScript type declaration for global fetch
declare global {
    namespace NodeJS {
      interface Global {
        fetch: jest.Mock;
      }
    }
  }
  
  // First, set up our mocks before importing modules
  jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  import { auth, AuthError } from '../auth';
  import * as SecureStore from 'expo-secure-store';
  
  // Create explicit mock for fetch
  const mockFetch = jest.fn();
  global.fetch = mockFetch as jest.Mock;
  
  describe('Auth Service', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Reset the SecureStore state
      (SecureStore as any)._reset();
    });
  
    describe('login functionality', () => {
      it('returns user object and token, stores in SecureStore', async () => {
        // Arrange
        const mockUser = { 
          id: 'user-123', 
          username: 'testuser', 
          email: 'test@example.com',
          profile: {
            name: 'Test User',
            isVerifiedProfessional: false
          }
        };
        const mockToken = 'test-token-123';
        const mockResponse = { 
          user: mockUser, 
          token: mockToken 
        };
        
        // Reset the fetch mock completely before setting it up
        global.fetch = jest.fn() as jest.Mock;
        
        // Define the implementation
        (global.fetch as jest.Mock).mockImplementation(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
    
        // Act
        const result = await auth.login({ 
          email: 'test@example.com', 
          password: 'password123' 
        });
    
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/auth/login',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              email: 'test@example.com', 
              password: 'password123' 
            }),
          })
        );
        
        // Verify result contains user and token
        expect(result).toEqual(mockResponse);
        
        // Verify token and user were stored in SecureStore
        expect(await SecureStore.getItemAsync('auth_token')).toBe(mockToken);
        expect(await SecureStore.getItemAsync('auth_user')).toBe(JSON.stringify(mockUser));
      });
    });
  
    describe('register functionality', () => {
      it('returns user object and token, stores in SecureStore', async () => {
        // Arrange
        const mockUser = { 
          id: 'user-456', 
          username: 'newuser', 
          email: 'new@example.com',
          profile: {
            name: 'New User',
            isVerifiedProfessional: false
          }
        };
        const mockToken = 'new-token-456';
        const mockResponse = { 
          user: mockUser, 
          token: mockToken 
        };
        
        const registerData = {
          username: 'newuser',
          email: 'new@example.com',
          password: 'newpass123',
          name: 'New User'
        };
        
        // Mock fetch with successful response
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await auth.register(registerData);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(registerData),
          })
        );
        
        // Verify result contains user and token
        expect(result).toEqual(mockResponse);
        
        // Verify token and user were stored in SecureStore
        expect(await SecureStore.getItemAsync('auth_token')).toBe(mockToken);
        expect(await SecureStore.getItemAsync('auth_user')).toBe(JSON.stringify(mockUser));
      });
    });
  
    describe('logout functionality', () => {
      it('removes stored token and user data', async () => {
        // Arrange - set up token and user data in SecureStore
        await SecureStore.setItemAsync('auth_token', 'existing-token');
        await SecureStore.setItemAsync('auth_user', JSON.stringify({ id: 'user-id' }));
        
        // Act
        await auth.logout();
        
        // Assert - verify data was removed from SecureStore
        expect(await SecureStore.getItemAsync('auth_token')).toBeNull();
        expect(await SecureStore.getItemAsync('auth_user')).toBeNull();
      });
    });
  
    describe('getAuthInfo', () => {
      it('returns object with token and user data when authenticated', async () => {
        // Arrange
        const mockUser = { 
          id: 'user-789', 
          username: 'existinguser',
          profile: {
            name: 'Existing User',
            isVerifiedProfessional: false
          }
        };
        const mockToken = 'existing-token-789';
        
        await SecureStore.setItemAsync('auth_token', mockToken);
        await SecureStore.setItemAsync('auth_user', JSON.stringify(mockUser));
        
        // Act
        const authInfo = await auth.getAuthInfo();
        
        // Assert
        expect(authInfo).toEqual({
          token: mockToken,
          user: mockUser
        });
      });
  
      it('returns null when not authenticated', async () => {
        // Arrange - make sure no token exists
        await SecureStore.deleteItemAsync('auth_token');
        
        // Act
        const authInfo = await auth.getAuthInfo();
        
        // Assert
        expect(authInfo).toBeNull();
      });
    });
  
    describe('getToken', () => {
      it('returns token when authenticated', async () => {
        // Arrange
        const mockToken = 'token-get-test';
        await SecureStore.setItemAsync('auth_token', mockToken);
        
        // Act
        const token = await auth.getToken();
        
        // Assert
        expect(token).toBe(mockToken);
      });
  
      it('returns null when not authenticated', async () => {
        // Act
        const token = await auth.getToken();
        
        // Assert
        expect(token).toBeNull();
      });
    });
  
    describe('error handling', () => {
      it('throws AuthError with appropriate message on server error', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Invalid credentials' })
          })
        );
        
        // Act & Assert
        await expect(auth.login({ 
          email: 'test@example.com', 
          password: 'wrong' 
        })).rejects.toThrow(AuthError);
        
        // Use a second test for the specific message
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Invalid credentials' })
          })
        );
        
        await expect(auth.login({ 
          email: 'test@example.com', 
          password: 'wrong' 
        })).rejects.toThrow('Invalid credentials');
      });
  
      it('throws AuthError for network failures', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() => 
          Promise.reject(new TypeError('Network request failed'))
        );
        
        // Act & Assert
        await expect(auth.login({ 
          email: 'test@example.com', 
          password: 'password123' 
        })).rejects.toThrow('Cannot connect to server');
      });
    });
  });