// services/healthSyncTaskManager.ts
import { DeviceToken } from '../Database/DeviceTokenSchema';

class HealthSyncTaskManager {
  private static instance: HealthSyncTaskManager;
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): HealthSyncTaskManager {
    if (!HealthSyncTaskManager.instance) {
      HealthSyncTaskManager.instance = new HealthSyncTaskManager();
    }
    return HealthSyncTaskManager.instance;
  }

  /**
   * Start the background sync task - Disabled as per user requirements
   */
  public startSyncTask(): void {
    console.log('Automatic health sync disabled as requested by user');
    return;
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
   * Update device record after manual sync
   * @param userId User ID that performed the manual sync
   */
  public async updateDeviceAfterSync(userId: string): Promise<void> {
    try {
      // Just update the last sync time for devices
      await DeviceToken.updateMany(
        { userId },
        { $set: { 'metadata.lastHealthSync': new Date() } }
      );
    } catch (error) {
      console.error(`Error updating device record after sync for user ${userId}:`, error);
    }
  }
}

export const healthSyncTaskManager = HealthSyncTaskManager.getInstance();