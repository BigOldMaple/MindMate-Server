import { auth } from '../auth';
import jwt from 'jsonwebtoken';

// Mock jwt library
jest.mock('jsonwebtoken');

describe('Auth Service', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('verifyToken', () => {
    it('should return decoded token for valid token', () => {
      const mockDecodedToken = { userId: 'user123' };
      
      // Mock jwt.verify to return our mock decoded token
      (jwt.verify as jest.Mock).mockReturnValue(mockDecodedToken);
      
      const result = auth.verifyToken('validToken');
      
      expect(jwt.verify).toHaveBeenCalledWith('validToken', expect.any(String));
      expect(result).toEqual(mockDecodedToken);
    });
    
    it('should throw error for invalid token', () => {
      // Mock jwt.verify to throw an error
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });
      
      expect(() => {
        auth.verifyToken('invalidToken');
      }).toThrow('Invalid token');
    });
    
    it('should throw error for empty token string', () => {
      // Mock jwt.verify to throw an error for empty string
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt must be provided');
      });
      
      expect(() => {
        auth.verifyToken('');
      }).toThrow();
    });
    
    it('should throw error for null or undefined token', () => {
      expect(() => {
        // @ts-ignore - Deliberately passing null to test error handling
        auth.verifyToken(null);
      }).toThrow();
      
      expect(() => {
        // @ts-ignore - Deliberately passing undefined to test error handling
        auth.verifyToken(undefined);
      }).toThrow();
    });
    
    it('should use the correct JWT_SECRET', () => {
      // Test with the actual fallback value used in code
      const expectedSecret = 'your-secret-key'; 
      
      (jwt.verify as jest.Mock).mockImplementation();
      
      auth.verifyToken('someToken');
      
      // Verify the actual secret is used
      expect(jwt.verify).toHaveBeenCalledWith('someToken', expectedSecret);
    });
  });
  
  describe('createAuthToken', () => {
    it('should create token with userId and return it', () => {
      const mockToken = 'generated-token';
      
      // Mock jwt.sign to return our mock token
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);
      
      const result = auth.createAuthToken('user123');
      
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user123' }, 
        expect.any(String), 
        { expiresIn: '7d' }
      );
      expect(result).toBe(mockToken);
    });
    
    it('should use the correct JWT_SECRET', () => {
      // Test with the actual fallback value used in code
      const expectedSecret = 'your-secret-key'; 
      
      (jwt.sign as jest.Mock).mockImplementation();
      
      auth.createAuthToken('user123');
      
      // Verify the actual secret is used
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user123' }, 
        expectedSecret, 
        { expiresIn: '7d' }
      );
    });
  });
  
  // Integration tests with actual JWT (not mocked)
  describe('JWT integration', () => {
    // Save the mocked implementation
    const mockedJwt = jest.requireMock('jsonwebtoken');
    
    // Restore original JWT for these tests
    beforeEach(() => {
      jest.resetModules();
      jest.unmock('jsonwebtoken');
    });
    
    // Restore the mock after these tests
    afterEach(() => {
      jest.mock('jsonwebtoken', () => mockedJwt);
    });
    
    it('should create and verify actual tokens', () => {
      // Import the actual modules for this test
      const actualJwt = jest.requireActual('jsonwebtoken');
      // We need to get a fresh copy of the auth module that uses the actual JWT
      const { auth: actualAuth } = jest.requireActual('../auth');
      
      const userId = 'test-user-123';
      
      // Create a real token
      const token = actualAuth.createAuthToken(userId);
      
      // Verify it's a string that looks like a JWT (three parts separated by dots)
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
      
      // Verify the token
      const decoded = actualAuth.verifyToken(token);
      expect(decoded).toHaveProperty('userId', userId);
    });
  });
});