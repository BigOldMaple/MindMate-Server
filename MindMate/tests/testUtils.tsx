// tests/testUtils.tsx
import React from 'react';
import { render as rtlRender } from '@testing-library/react-native';
import { AuthProvider } from '@/contexts/AuthContext';

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
};

const render = (ui: React.ReactElement, options = {}) => {
  return rtlRender(ui, { wrapper: AllTheProviders, ...options });
};

export * from '@testing-library/react-native';
export { render };