// integration-tests/peerSupport.test.ts
import { 
    setupIntegrationTestEnv, 
    teardownIntegrationTestEnv, 
    resetDatabase 
  } from './setup';
  import { 
    registerTestUser, 
    loginTestUser
  } from './helpers';
  
  let apiRequest: any;
  
  // Function to generate unique test users
  const generateUniqueTestUsers = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    
    return {
      user1: {
        username: `peer1_${timestamp}_${random}`,
        email: `peer1_${timestamp}_${random}@example.com`,
        password: 'Password123',
        name: 'Support Recipient'
      },
      user2: {
        username: `peer2_${timestamp}_${random}`,
        email: `peer2_${timestamp}_${random}@example.com`,
        password: 'Password123',
        name: 'Buddy Provider'
      },
      user3: {
        username: `peer3_${timestamp}_${random}`,
        email: `peer3_${timestamp}_${random}@example.com`,
        password: 'Password123',
        name: 'Community Member'
      }
    };
  };
  
  beforeAll(async () => {
    const setup = await setupIntegrationTestEnv();
    apiRequest = setup.apiRequest;
  });
  
  afterAll(async () => {
    await teardownIntegrationTestEnv();
  });
  
  describe('Peer Support System Integration Tests', () => {
    let user1Token: string;
    let user2Token: string;
    let user3Token: string;
    let testUsers: ReturnType<typeof generateUniqueTestUsers>;
    let communityId: string;
    
    beforeEach(async () => {
      await resetDatabase();
      
      // Generate unique test users for each test
      testUsers = generateUniqueTestUsers();
      
      // Register and login users
      await registerTestUser(testUsers.user1);
      const loginResponse1 = await loginTestUser({
        email: testUsers.user1.email,
        password: testUsers.user1.password
      });
      user1Token = loginResponse1.body.token;
      
      await registerTestUser(testUsers.user2);
      const loginResponse2 = await loginTestUser({
        email: testUsers.user2.email,
        password: testUsers.user2.password
      });
      user2Token = loginResponse2.body.token;
      
      await registerTestUser(testUsers.user3);
      const loginResponse3 = await loginTestUser({
        email: testUsers.user3.email,
        password: testUsers.user3.password
      });
      user3Token = loginResponse3.body.token;
    });
    
    it('should establish buddy relationship for peer support', async () => {
      // User1 sends buddy request to User2
      const requestResponse = await apiRequest
        .post('/api/buddy-peer/request')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ username: testUsers.user2.username });
      
      expect(requestResponse.status).toBe(200);
      
      // Get request ID from User2's perspective
      const requestsResponse = await apiRequest
        .get('/api/buddy-peer/requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(requestsResponse.body.length).toBeGreaterThan(0);
      const requestId = requestsResponse.body[0]._id;
      
      // User2 accepts buddy request
      const acceptResponse = await apiRequest
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ accept: true });
      
      expect(acceptResponse.status).toBe(200);
      
      // Verify buddy relationship
      const buddiesResponse = await apiRequest
        .get('/api/buddy-peer')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(buddiesResponse.status).toBe(200);
      expect(buddiesResponse.body.length).toBe(1);
      expect(buddiesResponse.body[0].username).toBe(testUsers.user2.username);
    });
    
    it('should create a community for peer support', async () => {
      // Create a community as User1
      const uniqueName = `Support Community ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: uniqueName,
          description: 'A community for mental health support testing',
          type: 'support'
        });
      
      expect(createResponse.status).toBe(201);
      communityId = createResponse.body._id;
      
      // User3 joins the community
      const joinResponse = await apiRequest
        .post(`/api/community/${communityId}/join`)
        .set('Authorization', `Bearer ${user3Token}`);
      
      expect(joinResponse.status).toBe(200);
      
      // Verify community membership
      const communityResponse = await apiRequest
        .get(`/api/community/${communityId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(communityResponse.status).toBe(200);
      expect(communityResponse.body.memberCount).toBe(2);
    });
    
    it('should get empty buddy support requests initially', async () => {
      // First establish the buddy relationship
      await apiRequest
        .post('/api/buddy-peer/request')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ username: testUsers.user2.username });
      
      const requestsResponse = await apiRequest
        .get('/api/buddy-peer/requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      const requestId = requestsResponse.body[0]._id;
      
      await apiRequest
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ accept: true });
      
      // Now get buddy support requests
      const supportResponse = await apiRequest
        .get('/api/mental-health/buddy-support-requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(supportResponse.status).toBe(200);
      expect(Array.isArray(supportResponse.body)).toBe(true);
      expect(supportResponse.body.length).toBe(0);
    });
    
    it('should get empty community support requests initially', async () => {
      // First create a community
      const uniqueName = `Support Community ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: uniqueName,
          description: 'A community for mental health support testing',
          type: 'support'
        });
      
      communityId = createResponse.body._id;
      
      // User3 joins the community
      await apiRequest
        .post(`/api/community/${communityId}/join`)
        .set('Authorization', `Bearer ${user3Token}`);
      
      // Now get community support requests
      const requestsResponse = await apiRequest
        .get('/api/mental-health/community-support-requests')
        .set('Authorization', `Bearer ${user3Token}`);
      
      expect(requestsResponse.status).toBe(200);
      expect(Array.isArray(requestsResponse.body)).toBe(true);
      expect(requestsResponse.body.length).toBe(0);
    });
    
    it('should get empty support statistics initially', async () => {
      // Get support statistics before providing any support
      const statsResponse = await apiRequest
        .get('/api/mental-health/support-statistics')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body).toHaveProperty('providedSupport');
      expect(statsResponse.body.providedSupport.total).toBe(0);
      expect(statsResponse.body).toHaveProperty('receivedSupport');
      expect(statsResponse.body.receivedSupport.total).toBe(0);
    });
    
    it('should generate test health data for mental health assessment', async () => {
      // Generate test health data
      const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]; // 7 days ago
      const generateResponse = await apiRequest
        .post('/api/health-data/generate-test-data')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          pattern: 'critical', // Critical pattern to trigger support needs
          startDate,
          days: 7
        });
      
      expect(generateResponse.status).toBe(200);
      expect(generateResponse.body.success).toBe(true);
      expect(generateResponse.body.metrics.daysGenerated).toBe(7);
    });
    
    it('should attempt to trigger a mental health assessment', async () => {
      // First generate health data
      const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      await apiRequest
        .post('/api/health-data/generate-test-data')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          pattern: 'critical',
          startDate,
          days: 7
        });
      
      // Try to trigger an assessment (may fail due to LLM dependency)
      const assessResponse = await apiRequest
        .post('/api/mental-health/assess')
        .set('Authorization', `Bearer ${user1Token}`);
      
      // We're only checking that the endpoint exists and returns something
      // The actual response might vary depending on the test environment
      expect(assessResponse.status).not.toBe(404);
      
      if (assessResponse.status === 200) {
        // If assessment succeeded, log some details
        console.log('Assessment status:', assessResponse.body.status);
        console.log('Needs support:', assessResponse.body.needsSupport);
      }
    });
    
    it('should verify the structure of support-related endpoints', async () => {
      // Check buddy support requests structure
      const buddyResponse = await apiRequest
        .get('/api/mental-health/buddy-support-requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(buddyResponse.status).toBe(200);
      expect(Array.isArray(buddyResponse.body)).toBe(true);
      
      // Check community support requests structure
      const communityResponse = await apiRequest
        .get('/api/mental-health/community-support-requests')
        .set('Authorization', `Bearer ${user3Token}`);
      
      expect(communityResponse.status).toBe(200);
      expect(Array.isArray(communityResponse.body)).toBe(true);
      
      // Check global support requests structure
      const globalResponse = await apiRequest
        .get('/api/mental-health/global-support-requests')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(globalResponse.status).toBe(200);
      expect(Array.isArray(globalResponse.body)).toBe(true);
      
      // Check support statistics structure
      const statsResponse = await apiRequest
        .get('/api/mental-health/support-statistics')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body).toHaveProperty('providedSupport');
      expect(statsResponse.body).toHaveProperty('receivedSupport');
      expect(statsResponse.body).toHaveProperty('supportImpact');
    });
    
    it('should handle provide-support endpoint with invalid assessment ID', async () => {
      // Use a valid format ObjectId that doesn't exist
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await apiRequest
        .post(`/api/mental-health/provide-support/${nonExistentId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      // This should return 404 because the assessment doesn't exist
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Assessment not found or support already provided');
    });
    
    it('should establish a full support network with buddy and community relationships', async () => {
      // Step 1: Establish buddy relationship between user1 and user2
      await apiRequest
        .post('/api/buddy-peer/request')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ username: testUsers.user2.username });
      
      const requestsResponse = await apiRequest
        .get('/api/buddy-peer/requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      const requestId = requestsResponse.body[0]._id;
      
      await apiRequest
        .post(`/api/buddy-peer/request/${requestId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ accept: true });
      
      // Step 2: Create a community and add user1 and user3
      const uniqueName = `Support Community ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: uniqueName,
          description: 'A community for mental health support testing',
          type: 'support'
        });
      
      communityId = createResponse.body._id;
      
      await apiRequest
        .post(`/api/community/${communityId}/join`)
        .set('Authorization', `Bearer ${user3Token}`);
      
      // Step 3: Verify relationships
      const buddiesResponse = await apiRequest
        .get('/api/buddy-peer')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(buddiesResponse.body.length).toBe(1);
      expect(buddiesResponse.body[0].username).toBe(testUsers.user2.username);
      
      const communityResponse = await apiRequest
        .get(`/api/community/${communityId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(communityResponse.body.memberCount).toBe(2);
      
      // Step 4: Generate health data
      const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      await apiRequest
        .post('/api/health-data/generate-test-data')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          pattern: 'critical',
          startDate,
          days: 7
        });
      
      // Step 5: Attempt to trigger assessment and check support routes
      await apiRequest
        .post('/api/mental-health/assess')
        .set('Authorization', `Bearer ${user1Token}`);
      
      // Check that all support routes are working
      const buddySupportResponse = await apiRequest
        .get('/api/mental-health/buddy-support-requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      const communitySupportResponse = await apiRequest
        .get('/api/mental-health/community-support-requests')
        .set('Authorization', `Bearer ${user3Token}`);
      
      const globalSupportResponse = await apiRequest
        .get('/api/mental-health/global-support-requests')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(buddySupportResponse.status).toBe(200);
      expect(communitySupportResponse.status).toBe(200);
      expect(globalSupportResponse.status).toBe(200);
      
      // The actual content of these responses depends on whether the assessment triggered support requests
      console.log('Buddy support requests:', buddySupportResponse.body.length);
      console.log('Community support requests:', communitySupportResponse.body.length);
      console.log('Global support requests:', globalSupportResponse.body.length);
    });
  });