// __mocks__/expo-device.js
module.exports = {
    DeviceType: {
      PHONE: 1,
      TABLET: 2,
      DESKTOP: 3,
      TV: 4,
      UNKNOWN: 0
    },
    brand: 'Jest',
    designName: 'Test Device',
    deviceName: 'Test Device',
    deviceYearClass: 2023,
    getDeviceTypeAsync: jest.fn().mockResolvedValue(1),
    isDevice: true,
    manufacturer: 'Jest Testing',
    modelId: 'Test-Model',
    modelName: 'Jest Test Model',
    osBuildId: '123456',
    osInternalBuildId: '123456',
    osName: 'Jest OS',
    osVersion: '1.0.0',
    platformApiLevel: 30,
    totalMemory: 8 * 1024 * 1024 * 1024, // 8GB in bytes
    supportedCpuArchitectures: ['x86_64'],
    deviceType: 1,
    getDeviceIdAsync: jest.fn().mockResolvedValue('test-device-id')
  };