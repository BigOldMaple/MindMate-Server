// MindMate/services/supportNotificationHandler.ts
import { notificationService } from './notificationService';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

/**
 * This service handles notifications related to the peer support system
 */
class SupportNotificationHandler {
  /**
   * Initialize support notification handling
   * Call this from the app's main component or entry point
   */
  public initialize() {
    // Set up notification received handler
    this.setupNotificationHandlers();
    console.log('Support notification handler initialized');
  }

  /**
   * Set up notification handlers for support-related notifications
   */
  private setupNotificationHandlers() {
    // This is a placeholder for any specific notification handling setup
    // In a real app with proper push notification setup, you'd register handlers here
  }

  /**
   * Process a new support notification
   * @param notification The notification object from the server
   */
  public async processNotification(notification: any) {
    if (!notification) return;

    const { type, actionRoute, assessmentId } = notification;

    // Store information about the most recent support request
    if (type === 'support') {
      await this.storeLatestSupportRequest(notification);
    }

    // For different support tiers, show different notifications
    switch (type) {
      case 'buddy_support':
        await this.showBuddySupportNotification(notification);
        break;
      case 'community_support':
        await this.showCommunitySupportNotification(notification);
        break;
      case 'global_support':
        await this.showGlobalSupportNotification(notification);
        break;
    }
  }

  /**
   * Store information about the latest support request for easy access
   */
  private async storeLatestSupportRequest(notification: any) {
    try {
      await SecureStore.setItemAsync(
        'latestSupportRequest',
        JSON.stringify({
          type: notification.type,
          timestamp: new Date().toISOString(),
          assessmentId: notification.assessmentId,
          route: notification.actionRoute
        })
      );
    } catch (error) {
      console.error('Error storing support request information:', error);
    }
  }

  /**
   * Show notification for buddy support requests
   */
  private async showBuddySupportNotification(notification: any) {
    await notificationService.sendLocalNotification(
      'Buddy Support Request',
      'Someone in your support network might need help',
      {
        type: 'buddy_support',
        actionable: true,
        actionRoute: '/buddy-support',
        assessmentId: notification.assessmentId
      }
    );
  }

  /**
   * Show notification for community support requests
   */
  private async showCommunitySupportNotification(notification: any) {
    await notificationService.sendLocalNotification(
      'Community Support Request',
      'A member of your community might need help',
      {
        type: 'community_support',
        actionable: true,
        actionRoute: '/community-support',
        assessmentId: notification.assessmentId
      }
    );
  }

  /**
   * Show notification for global support requests
   */
  private async showGlobalSupportNotification(notification: any) {
    await notificationService.sendLocalNotification(
      'Global Support Request',
      'A user on the platform might need support',
      {
        type: 'global_support',
        actionable: true,
        actionRoute: '/global-support',
        assessmentId: notification.assessmentId
      }
    );
  }

  /**
   * Navigate to the appropriate screen based on a support notification
   */
  public handleNotificationTap(notification: any) {
    if (!notification) return;

    const { type, actionRoute } = notification;

    if (actionRoute) {
      router.push(actionRoute);
    } else {
      // Default routing based on type
      switch (type) {
        case 'buddy_support':
          router.push('/buddy-support');
          break;
        case 'community_support':
          router.push('/community-support');
          break;
        case 'global_support':
          router.push('/global-support');
          break;
      }
    }
  }

  /**
   * Check if there are any active support requests
   */
  public async hasActiveSupportRequests(): Promise<boolean> {
    try {
      const latestRequestJson = await SecureStore.getItemAsync('latestSupportRequest');
      if (!latestRequestJson) return false;

      const latestRequest = JSON.parse(latestRequestJson);
      const timestamp = new Date(latestRequest.timestamp);
      const now = new Date();
      
      // Consider requests in the last 30 minutes as active
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
      
      return timestamp > thirtyMinutesAgo;
    } catch (error) {
      console.error('Error checking for active support requests:', error);
      return false;
    }
  }
}

export const supportNotificationHandler = new SupportNotificationHandler();