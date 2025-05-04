const AuthError = class AuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthError';
    }
  };
  
  const auth = {
    login: jest.fn(() => Promise.resolve({
      token: 'mock-token',
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser'
      }
    })),
    register: jest.fn(() => Promise.resolve({
      token: 'mock-token',
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        username: 'testuser'
      }
    })),
    logout: jest.fn(() => Promise.resolve(true))
  };
  
  module.exports = {
    auth,
    AuthError
  };