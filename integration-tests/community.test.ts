// integration-tests/community.test.ts
import { 
    setupIntegrationTestEnv, 
    teardownIntegrationTestEnv, 
    resetDatabase 
  } from './setup';
  import { 
    registerTestUser, 
    loginTestUser
  } from './helpers';
  import mongoose from 'mongoose';
  
  let apiRequest: any;
  
  // Test data for community creator
  const testUser1 = {
    username: 'communityuser1',
    email: 'community1@example.com',
    password: 'Password123',
    name: 'Community Creator'
  };
  
  // Test data for community joiner
  const testUser2 = {
    username: 'communityuser2',
    email: 'community2@example.com',
    password: 'Password123',
    name: 'Community Joiner'
  };
  
  beforeAll(async () => {
    const setup = await setupIntegrationTestEnv();
    apiRequest = setup.apiRequest;
  });
  
  afterAll(async () => {
    await teardownIntegrationTestEnv();
  });
  
  describe('Community Feature Integration Tests', () => {
    let user1Token: string;
    let user2Token: string;
    
    // Before each test, register both users and login to get their tokens
    beforeEach(async () => {
      await resetDatabase();
      
      // Register and login first user (community creator)
      await registerTestUser(testUser1);
      const loginResponse1 = await loginTestUser({
        email: testUser1.email,
        password: testUser1.password
      });
      user1Token = loginResponse1.body.token;
      
      // Register and login second user (community joiner)
      await registerTestUser(testUser2);
      const loginResponse2 = await loginTestUser({
        email: testUser2.email,
        password: testUser2.password
      });
      user2Token = loginResponse2.body.token;
    });
    
    it('should create a community successfully', async () => {
      // Use a unique name with timestamp for guaranteed uniqueness
      const uniqueName = `Test Support Group ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for integration testing',
        type: 'support'
      };
  
      console.log(`Creating community with name: ${uniqueName}`);
      
      const response = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      // Check response
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name', uniqueCommunity.name);
      expect(response.body).toHaveProperty('description', uniqueCommunity.description);
      expect(response.body).toHaveProperty('type', uniqueCommunity.type);
      expect(response.body).toHaveProperty('creator');
      expect(response.body).toHaveProperty('members');
      
      // Verify the creator is in the members list
      expect(response.body.members.length).toBe(1);
      expect(response.body.members[0]).toHaveProperty('role', 'admin');
    });
    
    it('should retrieve all communities', async () => {
      // Create a uniquely named community first
      const uniqueName = `Test Group ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing list retrieval',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Now get all communities
      const response = await apiRequest
        .get('/api/community')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Check that our created community is in the list
      const foundCommunity = response.body.find((c: any) => c._id === createdCommunityId);
      expect(foundCommunity).toBeDefined();
      expect(foundCommunity).toHaveProperty('name', uniqueCommunity.name);
      
      // Verify metadata for the first user
      expect(foundCommunity).toHaveProperty('isUserMember', true);
      expect(foundCommunity).toHaveProperty('userRole', 'admin');
    });
    
    it('should retrieve a specific community by ID', async () => {
      // Create a uniquely named community first
      const uniqueName = `Test Group ID ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing retrieval by ID',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Now get the specific community
      const response = await apiRequest
        .get(`/api/community/${createdCommunityId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', createdCommunityId);
      expect(response.body).toHaveProperty('name', uniqueName);
      expect(response.body).toHaveProperty('memberCount');
      expect(response.body).toHaveProperty('creatorDetails');
      expect(response.body).toHaveProperty('members');
    });
    
    it('should allow searching for communities', async () => {
      // Create a uniquely named community first with a searchable term
      const searchTerm = `SearchTest${Date.now()}`;
      const uniqueCommunity = {
        name: searchTerm,
        description: 'A community for testing search functionality',
        type: 'support'
      };
      
      await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
  
      // Now search for the community
      const response = await apiRequest
        .get('/api/community/search')
        .query({ query: searchTerm })
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify our community is found in search results
      const foundCommunity = response.body.find((c: any) => c.name === searchTerm);
      expect(foundCommunity).toBeDefined();
    });
    
    it('should allow second user to join a community', async () => {
      // Create a uniquely named community first
      const uniqueName = `Join Test ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing join functionality',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Second user joins the community
      const response = await apiRequest
        .post(`/api/community/${createdCommunityId}/join`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Successfully joined community');
      expect(response.body).toHaveProperty('community');
      expect(response.body.community).toHaveProperty('_id', createdCommunityId);
      expect(response.body.community).toHaveProperty('role', 'member');
    });
    
    it('should show updated membership after joining', async () => {
      // Create a uniquely named community first
      const uniqueName = `Membership Test ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing membership updates',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Second user joins the community
      await apiRequest
        .post(`/api/community/${createdCommunityId}/join`)
        .set('Authorization', `Bearer ${user2Token}`);
  
      // Get the community details from the second user's perspective
      const response = await apiRequest
        .get(`/api/community/${createdCommunityId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isUserMember', true);
      expect(response.body).toHaveProperty('userRole', 'member');
      expect(response.body).toHaveProperty('memberCount', 2);
      
      // Verify both users are in the members list
      expect(response.body.members.length).toBe(2);
    });
    
    it('should allow a user to leave a community', async () => {
      // Create a uniquely named community first
      const uniqueName = `Leave Test ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing leave functionality',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Second user joins and then leaves the community
      await apiRequest
        .post(`/api/community/${createdCommunityId}/join`)
        .set('Authorization', `Bearer ${user2Token}`);
  
      const response = await apiRequest
        .post(`/api/community/${createdCommunityId}/leave`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Successfully left community');
    });
    
    it('should show updated membership after leaving', async () => {
      // Create a uniquely named community first
      const uniqueName = `Leave Update Test ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing membership updates after leaving',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Second user joins and then leaves the community
      await apiRequest
        .post(`/api/community/${createdCommunityId}/join`)
        .set('Authorization', `Bearer ${user2Token}`);
  
      await apiRequest
        .post(`/api/community/${createdCommunityId}/leave`)
        .set('Authorization', `Bearer ${user2Token}`);
  
      // Get the community details
      const response = await apiRequest
        .get(`/api/community/${createdCommunityId}`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isUserMember', false);
      expect(response.body).toHaveProperty('userRole', null);
      expect(response.body).toHaveProperty('memberCount', 1);
    });
    
    it('should not allow community creator to leave', async () => {
      // Create a uniquely named community first
      const uniqueName = `Creator Leave Test ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const uniqueCommunity = {
        name: uniqueName,
        description: 'A community for testing creator leave restrictions',
        type: 'support'
      };
      
      const createResponse = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(uniqueCommunity);
      
      const createdCommunityId = createResponse.body._id;
  
      // Creator tries to leave the community
      const response = await apiRequest
        .post(`/api/community/${createdCommunityId}/leave`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Community creator cannot leave the community');
    });
    
    it('should handle non-existent community IDs gracefully', async () => {
      // Use a valid format ObjectId that doesn't exist in the database
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      const response = await apiRequest
        .get(`/api/community/${nonExistentId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should reject community creation without required fields', async () => {
      // Missing required fields
      const invalidCommunity = {
        name: 'Invalid Community'
        // Missing description and type
      };
      
      const response = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(invalidCommunity);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });
    
    it('should prevent duplicate community names', async () => {
      // Create a community
      const communityName = `Duplicate Test ${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      const testCommunity = {
        name: communityName,
        description: 'A community for testing duplicate names',
        type: 'support'
      };
      
      // Create the first community
      await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(testCommunity);
      
      // Try to create a community with the same name
      const duplicateNameCommunity = {
        name: communityName,
        description: 'Different description',
        type: 'support'
      };
      
      const response = await apiRequest
        .post('/api/community')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(duplicateNameCommunity);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Community name already exists');
    });
  });