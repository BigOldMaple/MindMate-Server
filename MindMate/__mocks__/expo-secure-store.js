// MindMate/__mocks__/expo-secure-store.js

// __mocks__/expo-secure-store.js
const mockSecureStore = {
    // In-memory storage
    _store: {},
  
    // Store a value securely
    setItemAsync: jest.fn((key, value) => {
      mockSecureStore._store[key] = value;
      return Promise.resolve();
    }),
  
    // Retrieve a stored value
    getItemAsync: jest.fn((key) => {
      return Promise.resolve(mockSecureStore._store[key] || null);
    }),
  
    // Delete a stored value
    deleteItemAsync: jest.fn((key) => {
      delete mockSecureStore._store[key];
      return Promise.resolve();
    }),
  
    // Helper for tests to reset the store between tests
    _reset: function() {
      mockSecureStore._store = {};
      jest.clearAllMocks();
    }
  };
  
  module.exports = mockSecureStore;