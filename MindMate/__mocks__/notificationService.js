// __mocks__/notificationService.js
module.exports = {
    notificationService: {
      initialize: jest.fn(),
      registerForPushNotifications: jest.fn(),
      scheduleLocalNotification: jest.fn().mockResolvedValue('local-notification-id'),
      sendLocalNotification: jest.fn().mockResolvedValue('local-notification-id'),
      requestPermissions: jest.fn().mockResolvedValue({ status: 'granted' })
    }
  };