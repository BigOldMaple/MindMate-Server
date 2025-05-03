// services/__tests__/healthTestingApi.test.ts

// Set up mocks before importing modules
jest.mock('../apiConfig', () => ({
    getApiUrl: jest.fn().mockReturnValue('http://test-api.com/api')
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { 
    healthTestingApi, 
    TestDataGenerationRequest, 
    TestDataGenerationResponse,
    ClearTestDataResponse
  } from '../healthTestingApi';
  
  // Create mock for global fetch
  global.fetch = jest.fn(() => 
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
  ) as jest.Mock;
  
  describe('Health Testing API Service', () => {
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
  
      // Silence console.error during tests
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  
    afterEach(() => {
      // Restore console.error
      (console.error as jest.Mock).mockRestore();
    });
  
    describe('generateTestData', () => {
      it('returns success response for valid pattern request', async () => {
        // Arrange
        const request: TestDataGenerationRequest = {
          pattern: 'good',
          startDate: '2025-04-01',
          days: 7
        };
        
        const mockResponse: TestDataGenerationResponse = {
          success: true,
          message: 'Test data generated successfully',
          metrics: {
            daysGenerated: 7,
            sleepRecords: 7,
            activityRecords: 14,
            exerciseRecords: 5
          }
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await healthTestingApi.generateTestData(request);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/health-data/generate-test-data',
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
          }
        );
        expect(result).toEqual(mockResponse);
      });
  
      it('correctly formats request for different patterns', async () => {
        // Test multiple patterns
        const patterns: ('good' | 'declining' | 'critical' | 'improving' | 'fluctuating')[] = [
          'good', 'declining', 'critical', 'improving', 'fluctuating'
        ];
        
        for (const pattern of patterns) {
          // Arrange
          const request: TestDataGenerationRequest = {
            pattern,
            startDate: '2025-04-01',
            days: 7
          };
          
          const mockResponse: TestDataGenerationResponse = {
            success: true,
            message: `${pattern} test data generated successfully`,
            metrics: {
              daysGenerated: 7,
              sleepRecords: 7,
              activityRecords: 14,
              exerciseRecords: 5
            }
          };
  
          (global.fetch as jest.Mock).mockImplementationOnce(() =>
            Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockResponse)
            })
          );
  
          // Act
          const result = await healthTestingApi.generateTestData(request);
  
          // Assert
          expect(global.fetch).toHaveBeenCalledWith(
            'http://test-api.com/api/health-data/generate-test-data',
            {
              method: 'POST',
              headers: {
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(request)
            }
          );
          expect(result).toEqual(mockResponse);
          expect(result.message).toContain(pattern);
        }
      });
  
      it('handles missing authentication error', async () => {
        // Arrange - no token in SecureStore
        await SecureStore.deleteItemAsync('userToken');
        
        const request: TestDataGenerationRequest = {
          pattern: 'good',
          startDate: '2025-04-01',
          days: 7
        };
  
        // Act & Assert
        await expect(healthTestingApi.generateTestData(request)).rejects.toThrow('Authentication required');
        expect(global.fetch).not.toHaveBeenCalled();
      });
  
      it('handles API errors', async () => {
        // Arrange
        const request: TestDataGenerationRequest = {
          pattern: 'good',
          startDate: '2025-04-01',
          days: 7
        };
        
        const errorMessage = 'Invalid pattern';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert
        await expect(healthTestingApi.generateTestData(request)).rejects.toThrow(errorMessage);
      });
  
      it('handles network failure', async () => {
        // Arrange
        const request: TestDataGenerationRequest = {
          pattern: 'good',
          startDate: '2025-04-01',
          days: 7
        };
        
        const networkError = new Error('Network request failed');
        (global.fetch as jest.Mock).mockImplementationOnce(() => Promise.reject(networkError));
  
        // Act & Assert
        await expect(healthTestingApi.generateTestData(request)).rejects.toThrow(networkError);
      });
    });
  
    describe('clearTestData', () => {
      it('returns success response for valid date range', async () => {
        // Arrange
        const startDate = '2025-04-01';
        const endDate = '2025-04-07';
        
        const mockResponse: ClearTestDataResponse = {
          success: true,
          message: 'Test data cleared successfully',
          count: 7
        };
  
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse)
          })
        );
  
        // Act
        const result = await healthTestingApi.clearTestData(startDate, endDate);
  
        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          'http://test-api.com/api/health-data/clear-test-data',
          {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer test-token',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ startDate, endDate })
          }
        );
        expect(result).toEqual(mockResponse);
      });
  
      it('handles missing authentication error', async () => {
        // Arrange - no token in SecureStore
        await SecureStore.deleteItemAsync('userToken');
        
        const startDate = '2025-04-01';
        const endDate = '2025-04-07';
  
        // Act & Assert
        await expect(healthTestingApi.clearTestData(startDate, endDate)).rejects.toThrow('Authentication required');
        expect(global.fetch).not.toHaveBeenCalled();
      });
  
      it('handles API errors', async () => {
        // Arrange
        const startDate = '2025-04-01';
        const endDate = '2025-04-07';
        
        const errorMessage = 'Invalid date range';
        (global.fetch as jest.Mock).mockImplementationOnce(() =>
          Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: errorMessage })
          })
        );
  
        // Act & Assert
        await expect(healthTestingApi.clearTestData(startDate, endDate)).rejects.toThrow(errorMessage);
      });
  
      it('handles network failure', async () => {
        // Arrange
        const startDate = '2025-04-01';
        const endDate = '2025-04-07';
        
        const networkError = new Error('Network request failed');
        (global.fetch as jest.Mock).mockImplementationOnce(() => Promise.reject(networkError));
  
        // Act & Assert
        await expect(healthTestingApi.clearTestData(startDate, endDate)).rejects.toThrow(networkError);
      });
    });
  });