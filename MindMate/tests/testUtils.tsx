// tests/testUtils.tsx
import React from 'react';
import { render as rtlRender } from '@testing-library/react-native';

// Mock auth value
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  username: 'testuser'
};

// Create a custom render function
const render = (ui: React.ReactElement, options = {}) => {
  return rtlRender(ui, options);
};

// Re-export everything
export * from '@testing-library/react-native';
export { render };