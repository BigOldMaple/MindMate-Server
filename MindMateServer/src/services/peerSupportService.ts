// services/peerSupportService.ts
import { Types } from 'mongoose';
import { User } from '../Database/Schema';
import { MentalHealthState } from '../Database/MentalHealthStateSchema';
import { pushNotificationService } from './pushNotificationService'; //not used yet

class PeerSupportService {
  /**
   * Initiate the tiered support request system
   */
  public async initiateSupportRequest(userId: string, assessmentId: Types.ObjectId): Promise<void> {
    try {
      // Get the user's buddy peers
      const user = await User.findById(userId)
        .select('buddyPeers')
        .populate('buddyPeers.userId');
        
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.buddyPeers.length === 0) {
        // No buddy peers, update the support request status to reflect this
        await MentalHealthState.findByIdAndUpdate(assessmentId, {
          $set: {
            supportRequestStatus: 'communityRequested',
            supportRequestTime: new Date()
          }
        });
        // Implement community support request
        // This would be implemented in the next phase
        console.log(`[PeerSupport] User ${userId} has no buddy peers, escalated to community tier`);
      } else {
        // User has buddy peers, request support from them
        await MentalHealthState.findByIdAndUpdate(assessmentId, {
          $set: {
            supportRequestStatus: 'buddyRequested',
            supportRequestTime: new Date()
          }
        });
        
        // Send notifications to buddy peers
        for (const buddy of user.buddyPeers) {
          try {
            // This will be implemented with your notification system
            // Example placeholder code:
            // await pushNotificationService.sendToUser(
            //   buddy.userId._id,
            //   'Support Needed',
            //   'Someone in your support network might need help',
            //   {
            //     type: 'support',
            //     actionRoute: '/buddy-support',
            //     relatedId: assessmentId
            //   }
            // );
            console.log(`[PeerSupport] Would notify buddy ${buddy.userId._id} for user ${userId}`);
          } catch (notifyError) {
            console.error(`[PeerSupport] Error notifying buddy ${buddy.userId._id}:`, notifyError);
            // Continue with other buddies even if notification fails for one
          }
        }
      }
    } catch (error) {
      console.error('[PeerSupport] Error initiating support request:', error);
      throw error;
    }
  }
  
  // Add other support related methods here
  // For example: escalateToNextTier, checkSupportStatus, etc.
}

// Export singleton instance
export const peerSupportService = new PeerSupportService();