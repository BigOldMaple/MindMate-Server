// services/healthSyncTaskManager.ts
import { DeviceToken } from '../Database/DeviceTokenSchema';
import { Types } from 'mongoose';

/**
 * Manages health data synchronization metadata
 */
class HealthSyncTaskManager {
  private static instance: HealthSyncTaskManager;
  
  private constructor() {}
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): HealthSyncTaskManager {
    if (!HealthSyncTaskManager.instance) {
      HealthSyncTaskManager.instance = new HealthSyncTaskManager();
    }
    return HealthSyncTaskManager.instance;
  }
  
  /**
   * This is a placeholder to maintain API compatibility with server startup.
   * Automatic background syncing is disabled as per requirements.
   */
  public startSyncTask(): void {
    console.log('Automatic health sync disabled as per requirements');
  }
  
  /**
   * This is a placeholder to maintain API compatibility.
   * No background sync is running so nothing needs to be stopped.
   */
  public stopSyncTask(): void {
    // No-op as background syncing is disabled
  }
  
  /**
   * Update device record after manual sync
   * @param userId User ID that performed the manual sync
   */
  public async updateDeviceAfterSync(userId: string): Promise<void> {
    try {
      // Update the last sync time for devices
      await DeviceToken.updateMany(
        { userId: new Types.ObjectId(userId) },
        { $set: { 'metadata.lastHealthSync': new Date() } }
      );
    } catch (error) {
      console.error(`Error updating device record after sync for user ${userId}:`, error);
    }
  }
}

// Export the singleton instance
export const healthSyncTaskManager = HealthSyncTaskManager.getInstance();