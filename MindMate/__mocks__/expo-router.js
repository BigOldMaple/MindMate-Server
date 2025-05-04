module.exports = {
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn()
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn()
    },
    Link: 'Link',
    Tabs: {
      Screen: 'Tabs.Screen'
    },
    Stack: {
      Screen: 'Stack.Screen'
    }
  };