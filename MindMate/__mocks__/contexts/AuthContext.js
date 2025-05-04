// __mocks__/contexts/AuthContext.js
const React = require('react');

const mockSignIn = jest.fn().mockImplementation(() => Promise.resolve());
const mockSignOut = jest.fn().mockImplementation(() => Promise.resolve());

const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  profile: {
    name: 'Test User',
    isVerifiedProfessional: false
  }
};

const mockAuthContext = {
  user: null,
  signIn: mockSignIn,
  signOut: mockSignOut,
  isLoading: false
};

const AuthContext = React.createContext(mockAuthContext);

const useAuth = jest.fn(() => mockAuthContext);

const AuthProvider = ({ children }) => {
  return React.createElement(AuthContext.Provider, { value: mockAuthContext }, children);
};

module.exports = {
  AuthContext,
  useAuth,
  AuthProvider,
  mockSignIn,
  mockSignOut
};