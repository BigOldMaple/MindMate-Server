import { 
    setupIntegrationTestEnv, 
    teardownIntegrationTestEnv, 
    resetDatabase 
  } from './setup';
  import { 
    registerTestUser, 
    loginTestUser, 
    accessProtectedRoute 
  } from './helpers';
  
  let apiRequest: any;
  
  // Test data
  const testUser = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123',
    name: 'Test User'
  };
  
  beforeAll(async () => {
    const setup = await setupIntegrationTestEnv();
    apiRequest = setup.apiRequest;
  });
  
  afterAll(async () => {
    await teardownIntegrationTestEnv();
  });
  
  beforeEach(async () => {
    await resetDatabase();
  });
  
  describe('Authentication Integration Tests', () => {
    it('should register a new user successfully', async () => {
      const response = await registerTestUser(testUser);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('username', testUser.username);
    });
  
    it('should fail registration with duplicate email', async () => {
      // Register first user
      await registerTestUser(testUser);
      
      // Try to register with same email
      const duplicateUser = {...testUser, username: 'different'};
      const response = await registerTestUser(duplicateUser);
      
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });
  
    it('should login successfully with correct credentials', async () => {
      // Register user first
      await registerTestUser(testUser);
      
      // Attempt login
      const response = await loginTestUser({
        email: testUser.email,
        password: testUser.password
      });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });
  
    it('should reject login with incorrect credentials', async () => {
      // Register user first
      await registerTestUser(testUser);
      
      // Attempt login with wrong password
      const response = await loginTestUser({
        email: testUser.email,
        password: 'wrongpassword'
      });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  
    it('should access protected route with valid token', async () => {
      // Register and login
      await registerTestUser(testUser);
      const loginResponse = await loginTestUser({
        email: testUser.email,
        password: testUser.password
      });
      
      // Get token
      const { token } = loginResponse.body;
      
      // Access protected route
      const response = await accessProtectedRoute(token, '/api/profile');
      
      expect(response.status).toBe(200);
    });
  
    it('should reject access to protected route with invalid token', async () => {
      // Access protected route with invalid token
      const response = await accessProtectedRoute('invalid-token', '/api/profile');
      
      expect(response.status).toBe(401);
    });
  });