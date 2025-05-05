import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { startServer } from '../MindMateServer/src/index';
import supertest from 'supertest';

// Variables to hold server and database instances
let mongoServer: MongoMemoryServer;
let expressServer: any;
let apiRequest: supertest.SuperTest<supertest.Test>;

// Set up test environment before running tests
export const setupIntegrationTestEnv = async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Configure environment variables for test
  process.env.MONGODB_URI = mongoUri;
  process.env.JWT_SECRET = 'test-jwt-secret-for-integration';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '5000';
  
  // Connect to test database
  await mongoose.connect(mongoUri);
  
  // Start Express server
  expressServer = await startServer(true); // Pass true to indicate test mode
  
  // Create supertest instance
  apiRequest = supertest(expressServer);
  
  return { apiRequest, expressServer };
};

// Clean up after tests
export const teardownIntegrationTestEnv = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  if (expressServer) {
    await expressServer.close();
  }
};

// Reset database between tests
export const resetDatabase = async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};