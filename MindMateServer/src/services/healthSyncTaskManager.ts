// server/services/healthSyncTaskManager.ts
import { User } from '../Database/Schema';
import { DeviceToken } from '../Database/DeviceTokenSchema';
import { pushNotificationService } from './pushNotificationService';

class HealthSyncTaskManager {
  private static instance: HealthSyncTaskManager;
  private syncInterval: NodeJS.Timeout | null = null;
  private syncIntervalMinutes = 15; // Default sync interval in minutes

  private constructor() {}

  public static getInstance(): HealthSyncTaskManager {
    if (!HealthSyncTaskManager.instance) {
      HealthSyncTaskManager.instance = new HealthSyncTaskManager();
    }
    return HealthSyncTaskManager.instance;
  }

  /**
   * Start the background sync task
   * @param intervalMinutes Sync interval in minutes (default: 15)
   */
  public startSyncTask(intervalMinutes?: number): void {
    if (this.syncInterval) {
      this.stopSyncTask();
    }

    // Update sync interval if provided
    if (intervalMinutes && intervalMinutes > 0) {
      this.syncIntervalMinutes = intervalMinutes;
    }

    console.log(`Starting health data sync task with ${this.syncIntervalMinutes} minute interval`);

    // Convert minutes to milliseconds for the interval
    const intervalMs = this.syncIntervalMinutes * 60 * 1000;

    // Start the sync interval
    this.syncInterval = setInterval(async () => {
      try {
        await this.performSyncForAllUsers();
      } catch (error) {
        console.error('Error in health data sync task:', error);
      }
    }, intervalMs);

    // Run immediately on startup
    this.performSyncForAllUsers().catch(error => {
      console.error('Error in initial health data sync:', error);
    });
  }

  /**
   * Stop the background sync task
   */
  public stopSyncTask(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Health data sync task stopped');
    }
  }

  /**
   * Perform sync for all users with active devices
   */
  private async performSyncForAllUsers(): Promise<void> {
    try {
      console.log('Starting health data sync for all users');
      
      // Find all active devices (active within the last 24 hours)
      const activeTime = new Date();
      activeTime.setHours(activeTime.getHours() - 24);
      
      const activeDevices = await DeviceToken.find({
        lastActive: { $gte: activeTime }
      })
      .select('userId platform')
      .lean();
      
      // Get unique user IDs
      const userIds = [...new Set(activeDevices.map(device => device.userId.toString()))];
      
      console.log(`Found ${userIds.length} users with active devices`);
      
      // For each user, request a health data sync
      for (const userId of userIds) {
        await this.requestHealthDataSync(userId);
      }
      
      console.log('Health data sync requests completed');
    } catch (error) {
      console.error('Error syncing health data for users:', error);
    }
  }

  /**
   * Request health data sync for a specific user
   * @param userId User ID to sync
   */
  public async requestHealthDataSync(userId: string): Promise<void> {
    try {
      // Get user's active Android devices
      const devices = await DeviceToken.find({
        userId,
        platform: 'android' // Health Connect is Android-only
      });
      
      if (devices.length === 0) {
        // No Android devices, skip sync
        return;
      }

      console.log(`Requesting health data sync for user ${userId} (${devices.length} Android devices)`);
      
      // Send a silent push notification to trigger sync on the client
      // This uses normal notification channels but with a special action type
      // The client app will recognize this and perform a health data sync
      const payload = {
        type: 'health_sync',
        action: 'sync_health_data',
        timestamp: new Date().toISOString()
      };
      
      // Use existing push notification service
      for (const device of devices) {
        try {
          // Create a silent notification that the app will handle without UI
          await pushNotificationService.sendPushNotification(
            device.token,
            'Health Data Sync', // Title (not shown to user)
            'Syncing your health data', // Body (not shown to user)
            payload, // Custom data payload
            true // Silent notification
          );
        } catch (error) {
          console.error(`Error sending sync notification to device ${device._id}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error requesting health data sync for user ${userId}:`, error);
    }
  }
}

export const healthSyncTaskManager = HealthSyncTaskManager.getInstance();