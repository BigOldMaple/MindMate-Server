// services/__tests__/mentalHealthApi.test.ts

// First, set up the mocks
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { mentalHealthApi, MentalHealthAssessment, PopulatedSupportRequest } from '../mentalHealthApi';
  
  // Important: Use this exact structure to mock fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  ) as jest.Mock;
  
  describe('Mental Health API Service', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Reset the SecureStore state
      (SecureStore as any)._reset();
      
      // Set up a token for auth
      SecureStore.setItemAsync('userToken', 'test-token');
      
      // Reset fetch mock to a default implementation
      (global.fetch as jest.Mock).mockReset().mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
      );
    });
  
    describe('getLatestAssessment', () => {
      it('fetches and returns the most recent mental health assessment', async () => {
        // Arrange
        const mockAssessment: MentalHealthAssessment = {
          _id: 'assess123',
          userId: 'user123',
          timestamp: '2025-04-01T12:00:00.000Z',
          mentalHealthStatus: 'stable',
          confidenceScore: 0.85,
          needsSupport: false,
          supportRequestStatus: 'none',
          reasoningData: {
            sleepQuality: 'good',
            activityLevel: 'moderate',
            checkInMood: 4
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAssessment)
          })
        );
  
        // Act
        const result = await mentalHealthApi.getLatestAssessment();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/assessment',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockAssessment);
      });
  
      it('handles errors when fetching assessment', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: 'Not found' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.getLatestAssessment()).rejects.toThrow('Failed to fetch mental health assessment');
      });
    });
  
    describe('triggerAssessment', () => {
      it('POSTs to assessment endpoint and returns result', async () => {
        // Arrange
        const mockAssessment: MentalHealthAssessment = {
          _id: 'assess456',
          userId: 'user123',
          timestamp: '2025-04-02T14:30:00.000Z',
          mentalHealthStatus: 'stable',
          confidenceScore: 0.92,
          needsSupport: false,
          supportRequestStatus: 'none',
          reasoningData: {
            sleepQuality: 'good',
            activityLevel: 'high',
            checkInMood: 5
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAssessment)
          })
        );
  
        // Act
        const result = await mentalHealthApi.triggerAssessment();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/assess',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
        expect(result).toEqual(mockAssessment);
      });
  
      it('handles errors when triggering assessment', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.triggerAssessment()).rejects.toThrow('Failed to trigger mental health assessment');
      });
    });
  
    describe('establishBaseline', () => {
      it('POSTs to baseline endpoint and returns result', async () => {
        // Arrange
        const mockBaselineResult = {
          _id: 'baseline123',
          userId: 'user123',
          timestamp: '2025-04-02T10:00:00.000Z',
          averageMetrics: {
            sleepHours: 7.5,
            activityLevel: 'moderate',
            moodScore: 4.2
          },
          success: true
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockBaselineResult)
          })
        );
  
        // Act
        const result = await mentalHealthApi.establishBaseline();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/establish-baseline',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
        expect(result).toEqual(mockBaselineResult);
      });
  
      it('handles errors when establishing baseline', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.establishBaseline()).rejects.toThrow('Failed to establish baseline');
      });
    });
  
    describe('analyzeRecentHealth', () => {
      it('POSTs to analyze endpoint and returns comparison results', async () => {
        // Arrange
        const mockAnalysisResult = {
          _id: 'analysis123',
          userId: 'user123',
          timestamp: '2025-04-03T15:20:00.000Z',
          comparisonToBaseline: {
            sleepChange: -0.5,
            activityChange: 0.2,
            moodChange: 0.1
          },
          significantChanges: ['Sleep quality has slightly decreased'],
          mentalHealthStatus: 'stable',
          confidenceScore: 0.88,
          needsSupport: false
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAnalysisResult)
          })
        );
  
        // Act
        const result = await mentalHealthApi.analyzeRecentHealth();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/analyze-recent',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
        expect(result).toEqual(mockAnalysisResult);
      });
  
      it('handles errors when analyzing recent health', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.analyzeRecentHealth()).rejects.toThrow('Failed to analyze recent health data');
      });
    });
  
    describe('getSupportRequests', () => {
      it('returns array of support requests for buddy tier', async () => {
        // Arrange
        const mockSupportRequests: PopulatedSupportRequest[] = [
          {
            _id: 'request123',
            userId: {
              _id: 'user456',
              username: 'testuser',
              profile: {
                name: 'Test User'
              }
            },
            timestamp: '2025-04-02T12:30:00.000Z',
            mentalHealthStatus: 'declining',
            confidenceScore: 0.75,
            needsSupport: true,
            supportRequestStatus: 'buddyRequested',
            supportRequestTime: '2025-04-02T12:35:00.000Z',
            reasoningData: {
              sleepQuality: 'poor',
              activityLevel: 'low',
              checkInMood: 2
            },
            supportReason: 'Low mood and poor sleep',
            supportTips: ['Suggest a short walk', 'Recommend sleep hygiene practices']
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSupportRequests)
          })
        );
  
        // Act
        const result = await mentalHealthApi.getBuddySupportRequests();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/buddy-support-requests',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockSupportRequests);
      });
  
      it('returns array of support requests for community tier', async () => {
        // Arrange
        const mockSupportRequests: PopulatedSupportRequest[] = [
          {
            _id: 'request789',
            userId: {
              _id: 'user555',
              username: 'communityuser',
              profile: {
                name: 'Community User'
              }
            },
            timestamp: '2025-04-03T10:15:00.000Z',
            mentalHealthStatus: 'critical',
            confidenceScore: 0.82,
            needsSupport: true,
            supportRequestStatus: 'communityRequested',
            supportRequestTime: '2025-04-03T10:20:00.000Z',
            reasoningData: {
              sleepQuality: 'poor',
              activityLevel: 'low',
              checkInMood: 1
            },
            supportReason: 'Very low mood and several concerning indicators',
            supportTips: ['Suggest discussing with a professional', 'Offer to chat']
          }
        ];
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSupportRequests)
          })
        );
  
        // Act
        const result = await mentalHealthApi.getCommunitySupportRequests();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/community-support-requests',
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockSupportRequests);
      });
  
      it('handles errors when fetching support requests', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.getBuddySupportRequests()).rejects.toThrow('Failed to fetch buddy support requests');
      });
    });
  
    describe('provideSupport', () => {
      it('POSTs to provide-support endpoint', async () => {
        // Arrange
        const assessmentId = 'assess789';
        const mockResponse = {
          success: true,
          message: 'Support provided successfully',
          updatedAssessment: {
            _id: assessmentId,
            supportRequestStatus: 'supportProvided',
            supportProvidedBy: 'user123',
            supportProvidedTime: '2025-04-03T16:45:00.000Z'
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await mentalHealthApi.provideSupport(assessmentId);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/mental-health/provide-support/${assessmentId}`,
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
        expect(result).toEqual(mockResponse);
      });
  
      it('handles errors when providing support', async () => {
        // Arrange
        const assessmentId = 'assess789';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.provideSupport(assessmentId)).rejects.toThrow('Failed to provide support');
      });
    });
  
    describe('getAssessmentHistory', () => {
      it('returns assessment history with specified limit', async () => {
        // Arrange
        const limit = 5;
        const mockHistory: MentalHealthAssessment[] = Array(5).fill(null).map((_, i) => ({
          _id: `hist${i}`,
          userId: 'user123',
          timestamp: new Date(Date.now() - (i * 86400000)).toISOString(),
          mentalHealthStatus: i % 2 === 0 ? 'stable' : 'declining',
          confidenceScore: 0.8 - (i * 0.05),
          needsSupport: i >= 3,
          supportRequestStatus: i >= 3 ? 'buddyRequested' : 'none',
          reasoningData: {
            sleepQuality: i >= 3 ? 'poor' : 'good',
            activityLevel: i >= 2 ? 'low' : 'moderate',
            checkInMood: 5 - i
          }
        }));
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockHistory)
          })
        );
  
        // Act
        const result = await mentalHealthApi.getAssessmentHistory(limit);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          `http://test-api.com/api/mental-health/history?limit=${limit}`,
          { headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' } }
        );
        expect(result).toEqual(mockHistory);
        expect(result.length).toBe(limit);
      });
  
      it('handles errors when fetching assessment history', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.getAssessmentHistory()).rejects.toThrow('Failed to fetch assessment history');
      });
    });
  
    describe('clearAssessmentData', () => {
      it('POSTs to clear-assessments endpoint', async () => {
        // Arrange
        const mockResponse = {
          success: true,
          message: 'Assessment data cleared successfully',
          count: 15
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await mentalHealthApi.clearAssessmentData();
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/mental-health/admin/clear-assessments',
          {
            method: 'POST',
            headers: { 'Authorization': 'Bearer test-token', 'Content-Type': 'application/json' }
          }
        );
        expect(result).toEqual(mockResponse);
      });
  
      it('handles errors when clearing assessment data', async () => {
        // Arrange
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Server error' })
          })
        );
  
        // Act & Assert
        await expect(mentalHealthApi.clearAssessmentData()).rejects.toThrow('Failed to clear assessment data');
      });
    });
  });