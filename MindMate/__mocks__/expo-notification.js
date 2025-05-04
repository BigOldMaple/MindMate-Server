// __mocks__/expo-notifications.js
module.exports = {
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'mock-expo-push-token' })),
    setNotificationHandler: jest.fn(),
    scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
    dismissAllNotificationsAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    setBadgeCountAsync: jest.fn(),
    getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([]))
  };