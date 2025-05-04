// __mocks__/expo-router.js
const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn()
  };
  
  const useRouter = jest.fn(() => router);
  const useSegments = jest.fn(() => []);
  const useLocalSearchParams = jest.fn(() => ({}));
  
  const Link = (props) => {
    const React = require('react');
    return React.createElement('Link', props, props.children);
  };
  
  const Stack = {
    Screen: (props) => {
      const React = require('react');
      return React.createElement('Stack.Screen', props, null);
    }
  };
  
  module.exports = {
    router,
    useRouter,
    useSegments,
    useLocalSearchParams,
    Link,
    Stack
  };