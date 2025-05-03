// services/__tests__/supportNotificationHandler.test.ts

// Mock dependencies
jest.mock('../notificationService', () => ({
    notificationService: {
      sendLocalNotification: jest.fn().mockResolvedValue('test-notification-id')
    }
  }));
  
  jest.mock('expo-router', () => ({
    router: {
      push: jest.fn()
    }
  }));
  
  import * as SecureStore from 'expo-secure-store';
  import { router } from 'expo-router';
  import { supportNotificationHandler } from '../supportNotificationHandler';
  import { notificationService } from '../notificationService';
  
  describe('Support Notification Handler', () => {
    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();
      
      // Reset the SecureStore state
      (SecureStore as any)._reset();
    });
  
    describe('initialize', () => {
      it('sets up notification handlers', () => {
        // Act
        supportNotificationHandler.initialize();
        
        // Assert - method should complete without errors
        // Since this is mostly a placeholder method currently, we just verify it runs
        expect(true).toBe(true);
      });
    });
  
    describe('process notifications', () => {
      it('processes buddy support notification', async () => {
        // Arrange
        const buddyNotification = {
          type: 'buddy_support',
          actionRoute: '/buddy-support',
          assessmentId: 'assess123'
        };
        
        // Act
        await supportNotificationHandler.processNotification(buddyNotification);
        
        // Assert
        expect(notificationService.sendLocalNotification).toHaveBeenCalledWith(
          'Buddy Support Request',
          'Someone in your support network might need help',
          expect.objectContaining({
            type: 'buddy_support',
            actionable: true,
            actionRoute: '/buddy-support',
            assessmentId: 'assess123'
          })
        );
      });
  
      it('processes community support notification', async () => {
        // Arrange
        const communityNotification = {
          type: 'community_support',
          actionRoute: '/community-support',
          assessmentId: 'assess456'
        };
        
        // Act
        await supportNotificationHandler.processNotification(communityNotification);
        
        // Assert
        expect(notificationService.sendLocalNotification).toHaveBeenCalledWith(
          'Community Support Request',
          'A member of your community might need help',
          expect.objectContaining({
            type: 'community_support',
            actionable: true,
            actionRoute: '/community-support',
            assessmentId: 'assess456'
          })
        );
      });
  
      it('processes global support notification', async () => {
        // Arrange
        const globalNotification = {
          type: 'global_support',
          actionRoute: '/global-support',
          assessmentId: 'assess789'
        };
        
        // Act
        await supportNotificationHandler.processNotification(globalNotification);
        
        // Assert
        expect(notificationService.sendLocalNotification).toHaveBeenCalledWith(
          'Global Support Request',
          'A user on the platform might need support',
          expect.objectContaining({
            type: 'global_support',
            actionable: true,
            actionRoute: '/global-support',
            assessmentId: 'assess789'
          })
        );
      });
  
      it('stores support request', async () => {
        // Arrange
        const supportNotification = {
          type: 'support',
          actionRoute: '/support-details',
          assessmentId: 'assess123'
        };
        
        const now = new Date();
        jest.spyOn(global, 'Date').mockImplementation(() => now as any);
        
        // Act
        await supportNotificationHandler.processNotification(supportNotification);
        
        // Assert
        expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
          'latestSupportRequest',
          JSON.stringify({
            type: 'support',
            timestamp: now.toISOString(),
            assessmentId: 'assess123',
            route: '/support-details'
          })
        );
        
        // Restore Date
        (global.Date as any).mockRestore();
      });
    });
  
    describe('handleNotificationTap', () => {
      it('navigates to the correct route when actionRoute is provided', () => {
        // Arrange
        const notification = {
          type: 'buddy_support',
          actionRoute: '/custom-route'
        };
        
        // Act
        supportNotificationHandler.handleNotificationTap(notification);
        
        // Assert
        expect(router.push).toHaveBeenCalledWith('/custom-route');
      });
  
      it('navigates to default route based on type when no actionRoute', () => {
        // Arrange
        const buddyNotification = { type: 'buddy_support' };
        const communityNotification = { type: 'community_support' };
        const globalNotification = { type: 'global_support' };
        
        // Act & Assert - Buddy support
        supportNotificationHandler.handleNotificationTap(buddyNotification);
        expect(router.push).toHaveBeenCalledWith('/buddy-support');
        
        // Reset mock
        jest.clearAllMocks();
        
        // Act & Assert - Community support
        supportNotificationHandler.handleNotificationTap(communityNotification);
        expect(router.push).toHaveBeenCalledWith('/community-support');
        
        // Reset mock
        jest.clearAllMocks();
        
        // Act & Assert - Global support
        supportNotificationHandler.handleNotificationTap(globalNotification);
        expect(router.push).toHaveBeenCalledWith('/global-support');
      });
  
      it('does nothing when notification is null', () => {
        // Act
        supportNotificationHandler.handleNotificationTap(null);
        
        // Assert
        expect(router.push).not.toHaveBeenCalled();
      });
    });
  
    describe('hasActiveSupportRequests', () => {
      it('returns true when there is a recent request', async () => {
        // Arrange
        const recentDate = new Date();
        const latestRequest = {
          type: 'support',
          timestamp: recentDate.toISOString(),
          assessmentId: 'assess123',
          route: '/support-details'
        };
        
        await SecureStore.setItemAsync('latestSupportRequest', JSON.stringify(latestRequest));
        
        // Act
        const result = await supportNotificationHandler.hasActiveSupportRequests();
        
        // Assert
        expect(result).toBe(true);
      });
  
      it('returns false when request is older than 30 minutes', async () => {
        // Arrange
        const now = new Date();
        const oldDate = new Date(now.getTime() - 31 * 60 * 1000); // 31 minutes ago
        
        const oldRequest = {
          type: 'support',
          timestamp: oldDate.toISOString(),
          assessmentId: 'assess123',
          route: '/support-details'
        };
        
        await SecureStore.setItemAsync('latestSupportRequest', JSON.stringify(oldRequest));
        
        // Mock current date for consistent testing
        const dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => now as any);
        
        // Act
        const result = await supportNotificationHandler.hasActiveSupportRequests();
        
        // Assert
        expect(result).toBe(false);
        
        // Restore Date
        dateSpy.mockRestore();
      });
  
      it('returns false when there are no stored requests', async () => {
        // Act
        const result = await supportNotificationHandler.hasActiveSupportRequests();
        
        // Assert
        expect(result).toBe(false);
      });
  
      it('handles storage errors', async () => {
        // Arrange
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(new Error('Storage error'));
        
        // Act
        const result = await supportNotificationHandler.hasActiveSupportRequests();
        
        // Assert
        expect(result).toBe(false);
        expect(consoleErrorSpy).toHaveBeenCalled();
        
        // Restore console.error
        consoleErrorSpy.mockRestore();
      });
    });
  });