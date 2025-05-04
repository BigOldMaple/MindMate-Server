// __tests__/pure-react.test.js
import React from 'react';
import { render } from '@testing-library/react-native';

// Create a pure React component that doesn't use RN components
const PureComponent = () => {
  // Use a basic HTML-like element that React test renderer understands
  return React.createElement('div', { 'data-testid': 'test-div' }, 'Hello World');
};

describe('Pure React Test', () => {
  it('renders a div element', () => {
    const { getByTestId } = render(<PureComponent />);
    expect(getByTestId('test-div')).toBeTruthy();
  });
});