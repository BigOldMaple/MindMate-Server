// __tests__/very-simple.test.js
import React from 'react';
import { View, Text } from 'react-native';
import { render } from '@testing-library/react-native';

describe('Minimal Test', () => {
  it('renders a simple View component', () => {
    const { getByTestId } = render(
      <View testID="test-view">
        <Text>Hello</Text>
      </View>
    );
    
    expect(getByTestId('test-view')).toBeTruthy();
  });
});