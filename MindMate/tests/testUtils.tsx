// tests/testUtils.tsx
import React from 'react';
import { render as rtlRender } from '@testing-library/react-native';
import { AuthProvider } from '@/contexts/AuthContext';

// Create a wrapper component to provide all necessary context
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

// Create a custom render function with the wrapper
const render = (ui: React.ReactElement, options = {}) => {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
};

// Re-export everything
export * from '@testing-library/react-native';
export { render };