// __mocks__/services/auth.js
const AuthError = class AuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthError';
    }
  };
  
  const auth = {
    login: jest.fn().mockImplementation(() => 
      Promise.resolve({
        token: 'test-token',
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          username: 'testuser',
          profile: {
            name: 'Test User',
            isVerifiedProfessional: false
          }
        }
      })
    ),
    register: jest.fn(),
    logout: jest.fn(),
    getAuthInfo: jest.fn(),
    getToken: jest.fn()
  };
  
  module.exports = {
    auth,
    AuthError
  };