const React = require('react');

const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  username: 'testuser'
};

const AuthContext = React.createContext({
  user: mockUser,
  isLoading: false,
  isAuthenticated: true,
  signIn: jest.fn(),
  signOut: jest.fn()
});

const useAuth = () => React.useContext(AuthContext);

const AuthProvider = ({ children }) => children;

module.exports = {
  AuthContext,
  useAuth,
  AuthProvider
};