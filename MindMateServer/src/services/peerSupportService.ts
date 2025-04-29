// services/peerSupportService.ts
import { Types } from 'mongoose';
import { User, IUser } from '../Database/Schema';
import { MentalHealthState, IMentalHealthState } from '../Database/MentalHealthStateSchema';
import { Notification } from '../Database/NotificationSchema';
import { pushNotificationService } from './pushNotificationService';

// Define interfaces for lean query results
interface UserLean {
  _id: Types.ObjectId;
  username: string;
  profile: {
    name: string;
  };
  buddyPeers: Array<{
    userId: Types.ObjectId;
    relationship: string;
    dateAdded: Date;
  }>;
  communities: Array<{
    communityId: Types.ObjectId;
    role: string;
    joinDate: Date;
  }>;
}

interface MentalHealthStateLean {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  supportRequestStatus: 'none' | 'buddyRequested' | 'communityRequested' | 'globalRequested' | 'supportProvided';
  supportRequestTime?: Date;
  supportProvidedBy?: Types.ObjectId;
  supportProvidedTime?: Date;
}

// Define types for community members
interface CommunityMember {
  _id: Types.ObjectId;
}

class PeerSupportService {
  // Constants for timeout values
  private readonly BUDDY_TIER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  private readonly COMMUNITY_TIER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  private readonly GLOBAL_NOTIFICATION_BATCH_SIZE = 10; // Number of users to notify in each batch
  private readonly GLOBAL_NOTIFICATION_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between batches

  // Track scheduled timeouts to allow cancellation
  private supportTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initiate the tiered support request system
   */
  public async initiateSupportRequest(userId: string, assessmentId: Types.ObjectId): Promise<void> {
    try {
      // Get the user's buddy peers
      const user = await User.findById(userId)
        .select('buddyPeers communities')
        .populate('buddyPeers.userId')
        .lean<UserLean>();

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.buddyPeers || user.buddyPeers.length === 0) {
        // No buddy peers, update the support request status to reflect this
        await MentalHealthState.findByIdAndUpdate(assessmentId, {
          $set: {
            supportRequestStatus: 'communityRequested',
            supportRequestTime: new Date()
          }
        });
        // Skip to community tier immediately
        await this.requestCommunitySupport(userId, assessmentId, user.communities || []);
        console.log(`[PeerSupport] User ${userId} has no buddy peers, escalated to community tier`);
      } else {
        // User has buddy peers, request support from them
        await MentalHealthState.findByIdAndUpdate(assessmentId, {
          $set: {
            supportRequestStatus: 'buddyRequested',
            supportRequestTime: new Date()
          }
        });

        // Extract valid buddy IDs correctly from the populated user document
        const buddyIds: string[] = [];

        for (const buddy of user.buddyPeers) {
          // Handle both populated and unpopulated cases
          if (buddy.userId) {
            if (typeof buddy.userId === 'string') {
              // If it's already a string ID
              buddyIds.push(buddy.userId);
            } else if (buddy.userId._id) {
              // If it's a populated object with _id
              buddyIds.push(buddy.userId._id.toString());
            }
          }
        }

        console.log(`[PeerSupport] Found ${buddyIds.length} valid buddy IDs for user ${userId}`);

        if (buddyIds.length > 0) {
          await this.notifyBuddyPeers(userId, assessmentId, buddyIds);

          // Schedule escalation if no response within timeout
          this.scheduleEscalation(userId, assessmentId, 'buddy', user.communities || []);
        } else {
          // No valid buddy IDs found, escalate to community tier
          console.log(`[PeerSupport] No valid buddy IDs found for user ${userId}, escalating to community tier`);
          await this.requestCommunitySupport(userId, assessmentId, user.communities || []);
        }
      }
    } catch (error) {
      console.error('[PeerSupport] Error initiating support request:', error);
      // Don't rethrow - we should continue even if buddy notification fails
    }
  }

  /**
   * Notify buddy peers about a support request
   */
  private async notifyBuddyPeers(
    userId: string | Types.ObjectId,
    assessmentId: Types.ObjectId,
    buddyIds: string[]
  ): Promise<void> {
    try {
      let validNotifications = 0;
      let invalidIds = 0;

      for (const buddyId of buddyIds) {
        try {
          // Ensure buddyId is a valid string
          const validBuddyId = String(buddyId).trim();

          // Validate that we have a valid MongoDB ObjectId string (24-character hex string)
          if (!validBuddyId.match(/^[0-9a-fA-F]{24}$/)) {
            console.warn(`[PeerSupport] Invalid buddy ID format: ${validBuddyId}`);
            invalidIds++;
            continue; // Skip this buddy
          }

          // Create database notification with proper ObjectId conversion
          const notification = new Notification({
            userId: new Types.ObjectId(validBuddyId),
            type: 'support',
            title: 'Support Request',
            message: 'Someone in your support network might need help',
            read: false,
            time: new Date(),
            actionable: true,
            actionRoute: '/buddy-support',
            actionParams: { assessmentId: assessmentId.toString() },
            relatedId: assessmentId
          });
          await notification.save();

          // Send push notification
          await pushNotificationService.sendToUser(
            validBuddyId,
            'Support Request',
            'Someone in your support network might need help',
            {
              type: 'support',
              actionRoute: '/buddy-support',
              relatedId: assessmentId
            }
          );

          validNotifications++;
          console.log(`[PeerSupport] Notified buddy ${validBuddyId} for user ${userId}`);
        } catch (buddyError) {
          console.error(`[PeerSupport] Error notifying buddy ${buddyId}:`, buddyError);
          // Continue with next buddy instead of failing completely
        }
      }

      console.log(`[PeerSupport] Notification summary: ${validNotifications} successful, ${invalidIds} invalid IDs skipped`);
    } catch (error) {
      console.error('[PeerSupport] Error in notifyBuddyPeers:', error);
    }
  }

  /**
   * Request support from community members
   */
  private async requestCommunitySupport(
    userId: string,
    assessmentId: Types.ObjectId,
    userCommunities: Array<{ communityId: Types.ObjectId; role: string; joinDate: Date }>
  ): Promise<void> {
    try {
      // Update the assessment status
      await MentalHealthState.findByIdAndUpdate(assessmentId, {
        $set: {
          supportRequestStatus: 'communityRequested',
          supportRequestTime: new Date()
        }
      });

      if (userCommunities.length === 0) {
        // No communities, escalate to global tier
        console.log(`[PeerSupport] User ${userId} has no communities, escalating to global tier`);
        await this.requestGlobalSupport(userId, assessmentId);
        return;
      }

      // Get unique community IDs
      const communityIds = userCommunities.map(comm => comm.communityId.toString());

      // Find all users in these communities except the user needing help and buddy peers who already were notified
      const buddyPeers = await User.findById(userId).select('buddyPeers').lean<{ buddyPeers: Array<{ userId: Types.ObjectId }> }>();
      const buddyPeerIds = buddyPeers?.buddyPeers?.map(buddy => buddy.userId.toString()) || [];

      const communityMembers = await User.find({
        _id: {
          $ne: new Types.ObjectId(userId),
          $nin: buddyPeerIds.map(id => new Types.ObjectId(id))
        },
        'communities.communityId': { $in: communityIds.map(id => new Types.ObjectId(id)) }
      }).select('_id').lean<CommunityMember[]>();

      // Get unique user IDs
      const memberIds = Array.from(new Set(communityMembers.map(member => member._id.toString())));

      if (memberIds.length === 0) {
        // No community members other than buddies who were already notified, escalate to global tier
        console.log(`[PeerSupport] No additional community members found, escalating to global tier`);
        await this.requestGlobalSupport(userId, assessmentId);
        return;
      }

      // Notify community members
      for (const memberId of memberIds) {
        // Create database notification
        const notification = new Notification({
          userId: memberId,
          type: 'support',
          title: 'Community Support Request',
          message: 'A member of your community might need help',
          read: false,
          time: new Date(),
          actionable: true,
          actionRoute: '/community-support',
          actionParams: { assessmentId: assessmentId.toString() },
          relatedId: assessmentId
        });
        await notification.save();

        // Send push notification
        await pushNotificationService.sendToUser(
          memberId,
          'Community Support Request',
          'A member of your community might need help',
          {
            type: 'support',
            actionRoute: '/community-support',
            relatedId: assessmentId
          }
        );
      }

      console.log(`[PeerSupport] Notified ${memberIds.length} community members for user ${userId}`);

      // Schedule escalation if no response within timeout
      this.scheduleEscalation(userId, assessmentId, 'community', []);
    } catch (error) {
      console.error('[PeerSupport] Error requesting community support:', error);
    }
  }

  /**
   * Request support from global users
   */
  private async requestGlobalSupport(userId: string, assessmentId: Types.ObjectId): Promise<void> {
    try {
      // Update the assessment status
      await MentalHealthState.findByIdAndUpdate(assessmentId, {
        $set: {
          supportRequestStatus: 'globalRequested',
          supportRequestTime: new Date()
        }
      });

      // Get all users except the requesting user, buddy peers, and community members already notified
      const user = await User.findById(userId).select('buddyPeers communities').lean<UserLean>();
      const buddyPeerIds = user?.buddyPeers?.map(buddy => buddy.userId.toString()) || [];
      const communityIds = user?.communities?.map(comm => comm.communityId.toString()) || [];

      // Find members of user's communities to exclude
      let communityMemberIds: string[] = [];
      if (communityIds.length > 0) {
        const communityMembers = await User.find({
          'communities.communityId': { $in: communityIds.map(id => new Types.ObjectId(id)) }
        }).select('_id').lean<CommunityMember[]>();

        communityMemberIds = communityMembers.map(member => member._id.toString());
      }

      // Create exclusion list combining user, buddies, and community members
      const excludeIds = Array.from(new Set([
        userId,
        ...buddyPeerIds,
        ...communityMemberIds
      ]));

      // Find all other users for global support
      const globalUsers = await User.find({
        _id: { $nin: excludeIds.map(id => new Types.ObjectId(id)) }
      }).select('_id').lean<CommunityMember[]>();

      if (globalUsers.length === 0) {
        console.log(`[PeerSupport] No global users found to notify for user ${userId}`);
        return;
      }

      // Send notifications in batches to avoid overloading
      this.sendGlobalNotificationsInBatches(
        userId,
        assessmentId,
        globalUsers.map(user => user._id.toString())
      );
    } catch (error) {
      console.error('[PeerSupport] Error requesting global support:', error);
    }
  }

  /**
   * Send notifications to global users in batches
   */
  private sendGlobalNotificationsInBatches(
    userId: string,
    assessmentId: Types.ObjectId,
    userIds: string[]
  ): void {
    // Create batches of users
    const batches: string[][] = [];
    for (let i = 0; i < userIds.length; i += this.GLOBAL_NOTIFICATION_BATCH_SIZE) {
      batches.push(userIds.slice(i, i + this.GLOBAL_NOTIFICATION_BATCH_SIZE));
    }

    console.log(`[PeerSupport] Sending global notifications in ${batches.length} batches for user ${userId}`);

    // Function to process a batch
    const processBatch = async (batchIndex: number) => {
      if (batchIndex >= batches.length) {
        console.log(`[PeerSupport] All global notification batches sent for user ${userId}`);
        return;
      }

      // Check if support has already been provided
      const assessment = await MentalHealthState.findById(assessmentId).lean<MentalHealthStateLean>();
      if (assessment?.supportRequestStatus === 'supportProvided') {
        console.log(`[PeerSupport] Support already provided for assessment ${assessmentId}, stopping further notifications`);
        return;
      }

      const batch = batches[batchIndex];
      console.log(`[PeerSupport] Sending batch ${batchIndex + 1}/${batches.length} with ${batch.length} users for user ${userId}`);

      // Send notifications to this batch
      for (const recipientId of batch) {
        // Create database notification
        const notification = new Notification({
          userId: recipientId,
          type: 'support',
          title: 'Global Support Request',
          message: 'A user on the platform might need help',
          read: false,
          time: new Date(),
          actionable: true,
          actionRoute: '/global-support',
          actionParams: { assessmentId: assessmentId.toString() },
          relatedId: assessmentId
        });
        await notification.save();

        // Send push notification
        await pushNotificationService.sendToUser(
          recipientId,
          'Global Support Request',
          'A user on the platform might need help',
          {
            type: 'support',
            actionRoute: '/global-support',
            relatedId: assessmentId
          }
        );
      }

      // Schedule the next batch
      setTimeout(() => {
        processBatch(batchIndex + 1);
      }, this.GLOBAL_NOTIFICATION_INTERVAL_MS);
    };

    // Start processing the first batch
    processBatch(0);
  }

  /**
   * Schedule escalation to the next tier after timeout
   */
  private scheduleEscalation(
    userId: string,
    assessmentId: Types.ObjectId,
    currentTier: 'buddy' | 'community',
    communities: Array<{ communityId: Types.ObjectId; role: string; joinDate: Date }>
  ): void {
    // Calculate timeout based on current tier
    const timeout = currentTier === 'buddy'
      ? this.BUDDY_TIER_TIMEOUT_MS
      : this.COMMUNITY_TIER_TIMEOUT_MS;

    // Generate a unique key for this timeout
    const timeoutKey = `${assessmentId.toString()}-${currentTier}`;

    // Clear any existing timeout with this key
    if (this.supportTimeouts.has(timeoutKey)) {
      clearTimeout(this.supportTimeouts.get(timeoutKey));
      this.supportTimeouts.delete(timeoutKey);
    }

    // Schedule the escalation
    const timeoutId = setTimeout(async () => {
      try {
        // Check if support has already been provided
        const assessment = await MentalHealthState.findById(assessmentId).lean<MentalHealthStateLean>();
        if (!assessment || assessment.supportRequestStatus === 'supportProvided') {
          console.log(`[PeerSupport] Support already provided for assessment ${assessmentId}, no escalation needed`);
          return;
        }

        console.log(`[PeerSupport] Escalating from ${currentTier} tier for user ${userId} after timeout`);

        // Escalate to the next tier
        if (currentTier === 'buddy') {
          await this.requestCommunitySupport(userId, assessmentId, communities);
        } else if (currentTier === 'community') {
          await this.requestGlobalSupport(userId, assessmentId);
        }

        // Remove this timeout from the map
        this.supportTimeouts.delete(timeoutKey);
      } catch (error) {
        console.error(`[PeerSupport] Error during escalation from ${currentTier} tier:`, error);
      }
    }, timeout);

    // Store the timeout ID for potential cancellation
    this.supportTimeouts.set(timeoutKey, timeoutId);

    console.log(`[PeerSupport] Scheduled escalation from ${currentTier} tier for user ${userId} in ${timeout / 60000} minutes`);
  }

  /**
   * Record when support has been provided
   */
  public async recordSupportProvided(
    assessmentId: Types.ObjectId,
    supportProviderId: string
  ): Promise<boolean> {
    try {
      // First, get the current assessment to determine the tier
      const assessment = await MentalHealthState.findById(assessmentId);

      if (!assessment) {
        console.error(`[PeerSupport] Assessment ${assessmentId} not found when recording support`);
        return false;
      }

      // Extract the tier from the current status before changing it
      let supportTier: 'buddy' | 'community' | 'global' = 'buddy'; // Default to buddy

      // Parse tier from status (buddyRequested → buddy, communityRequested → community, etc.)
      if (assessment.supportRequestStatus === 'buddyRequested') {
        supportTier = 'buddy';
      } else if (assessment.supportRequestStatus === 'communityRequested') {
        supportTier = 'community';
      } else if (assessment.supportRequestStatus === 'globalRequested') {
        supportTier = 'global';
      }

      // Now update the assessment
      assessment.supportRequestStatus = 'supportProvided';
      assessment.supportProvidedBy = new Types.ObjectId(supportProviderId);
      assessment.supportProvidedTime = new Date();
      await assessment.save();

      // Cancel any pending escalations
      const buddyTimeoutKey = `${assessmentId.toString()}-buddy`;
      const communityTimeoutKey = `${assessmentId.toString()}-community`;

      if (this.supportTimeouts.has(buddyTimeoutKey)) {
        clearTimeout(this.supportTimeouts.get(buddyTimeoutKey)!);
        this.supportTimeouts.delete(buddyTimeoutKey);
      }

      if (this.supportTimeouts.has(communityTimeoutKey)) {
        clearTimeout(this.supportTimeouts.get(communityTimeoutKey)!);
        this.supportTimeouts.delete(communityTimeoutKey);
      }

      console.log(`[PeerSupport] Support provided by user ${supportProviderId} for assessment ${assessmentId}`);

      // Pass the correctly extracted tier to updateSupportStatistics
      await this.updateSupportStatisticsWithTier(assessmentId, supportProviderId, supportTier);

      // Notify the user in need that someone has offered support
      const userId = assessment.userId.toString();
      await this.notifySupportProvided(userId, supportProviderId);

      return true;
    } catch (error) {
      console.error('[PeerSupport] Error recording support provided:', error);
      return false;
    }
  }

  // New method to update statistics with a known tier
  private async updateSupportStatisticsWithTier(
    assessmentId: Types.ObjectId,
    supportProviderId: string,
    tier: 'buddy' | 'community' | 'global'
  ): Promise<void> {
    try {
      // Get the mental health assessment to determine the recipient
      const assessment = await MentalHealthState.findById(assessmentId).lean<MentalHealthStateLean>();
      if (!assessment) {
        console.error(`[PeerSupport] Assessment ${assessmentId} not found when updating statistics`);
        return;
      }

      const recipientId = assessment.userId.toString();

      // Update provider statistics
      await this.updateProviderStats(supportProviderId, tier, recipientId, assessmentId);

      // Update recipient statistics
      await this.updateRecipientStats(recipientId, tier, supportProviderId, assessmentId);

      console.log(`[PeerSupport] Updated support statistics for provider ${supportProviderId} and recipient ${recipientId}`);
    } catch (error) {
      console.error('[PeerSupport] Error updating support statistics:', error);
    }
  }

  /**
   * Update support statistics when support is provided
   */
  private async updateSupportStatistics(
    assessmentId: Types.ObjectId,
    supportProviderId: string
  ): Promise<void> {
    try {
      // Get the mental health assessment to determine tier and recipient
      const assessment = await MentalHealthState.findById(assessmentId).lean<MentalHealthStateLean>();
      if (!assessment) {
        console.error(`[PeerSupport] Assessment ${assessmentId} not found when updating statistics`);
        return;
      }

      const recipientId = assessment.userId.toString();
      const supportTier = assessment.supportRequestStatus.replace('Requested', '') as 'buddy' | 'community' | 'global';

      // Update provider statistics
      await this.updateProviderStats(supportProviderId, supportTier, recipientId, assessmentId);

      // Update recipient statistics
      await this.updateRecipientStats(recipientId, supportTier, supportProviderId, assessmentId);

      console.log(`[PeerSupport] Updated support statistics for provider ${supportProviderId} and recipient ${recipientId}`);
    } catch (error) {
      console.error('[PeerSupport] Error updating support statistics:', error);
    }
  }

  /**
   * Update statistics for the support provider
   */
  private async updateProviderStats(
    providerId: string,
    tier: 'buddy' | 'community' | 'global',
    recipientId: string,
    assessmentId: Types.ObjectId
  ): Promise<void> {
    try {
      // Import SupportStatistics to avoid circular dependencies
      const { SupportStatistics } = require('../Database/SupportStatisticsSchema');

      // Get or create provider stats document
      let providerStats = await SupportStatistics.findOne({ userId: new Types.ObjectId(providerId) });

      if (!providerStats) {
        providerStats = new SupportStatistics({
          userId: new Types.ObjectId(providerId),
          supportProvided: {
            total: 0,
            buddyTier: 0,
            communityTier: 0,
            globalTier: 0,
            lastProvidedAt: null
          },
          supportReceived: {
            total: 0,
            buddyTier: 0,
            communityTier: 0,
            globalTier: 0,
            lastReceivedAt: null
          },
          supportHistory: []
        });
      }

      // Update provided support counters
      providerStats.supportProvided.total += 1;
      providerStats.supportProvided[`${tier}Tier`] += 1;
      providerStats.supportProvided.lastProvidedAt = new Date();

      // Add to support history
      providerStats.supportHistory.push({
        type: 'provided',
        tier: tier, // Use the tier parameter that's passed in ('buddy', 'community', or 'global')
        timestamp: new Date(),
        userId: new Types.ObjectId(recipientId),
        assessmentId
      });

      await providerStats.save();
    } catch (error) {
      console.error('[PeerSupport] Error updating provider statistics:', error);
    }
  }

  /**
   * Update statistics for the support recipient
   */
  private async updateRecipientStats(
    recipientId: string,
    tier: 'buddy' | 'community' | 'global',
    providerId: string,
    assessmentId: Types.ObjectId
  ): Promise<void> {
    try {
      // Import SupportStatistics to avoid circular dependencies
      const { SupportStatistics } = require('../Database/SupportStatisticsSchema');

      // Get or create recipient stats document
      let recipientStats = await SupportStatistics.findOne({ userId: new Types.ObjectId(recipientId) });

      if (!recipientStats) {
        recipientStats = new SupportStatistics({
          userId: new Types.ObjectId(recipientId),
          supportProvided: {
            total: 0,
            buddyTier: 0,
            communityTier: 0,
            globalTier: 0,
            lastProvidedAt: null
          },
          supportReceived: {
            total: 0,
            buddyTier: 0,
            communityTier: 0,
            globalTier: 0,
            lastReceivedAt: null
          },
          supportHistory: []
        });
      }

      // Update received support counters
      recipientStats.supportReceived.total += 1;
      recipientStats.supportReceived[`${tier}Tier`] += 1;
      recipientStats.supportReceived.lastReceivedAt = new Date();

      // Add to support history
      recipientStats.supportHistory.push({
        type: 'received',
        tier,
        timestamp: new Date(),
        userId: new Types.ObjectId(providerId),
        assessmentId
      });

      await recipientStats.save();
    } catch (error) {
      console.error('[PeerSupport] Error updating recipient statistics:', error);
    }
  }

  /**
   * Notify the user that someone has offered support
   */
  private async notifySupportProvided(userId: string, supportProviderId: string): Promise<void> {
    try {
      // Get support provider's name for the notification
      const supporter = await User.findById(supportProviderId).select('username profile.name').lean<{
        username: string;
        profile?: {
          name?: string;
        };
      }>();
      const supporterName = supporter?.profile?.name || supporter?.username || 'Someone';

      // Create a notification
      const notification = new Notification({
        userId,
        type: 'support',
        title: 'Support Offered',
        message: `${supporterName} has offered to support you`,
        read: false,
        time: new Date(),
        actionable: true,
        actionRoute: '/messages/[id]',
        actionParams: { id: supportProviderId }
      });
      await notification.save();

      // Send push notification
      await pushNotificationService.sendToUser(
        userId,
        'Support Offered',
        `${supporterName} has offered to support you`,
        {
          type: 'support',
          actionRoute: '/messages/[id]',
          actionParams: { id: supportProviderId }
        }
      );
    } catch (error) {
      console.error('[PeerSupport] Error notifying user about support:', error);
    }
  }

  /**
   * Get all active support requests for a specific tier
   */
  public async getActiveSupportRequests(
    tier: 'buddy' | 'community' | 'global',
    userId: string
  ): Promise<any[]> {
    try {
      // Determine which status to look for based on tier
      let supportRequestStatus: string;
      let additionalQuery: any = {};

      switch (tier) {
        case 'buddy':
          supportRequestStatus = 'buddyRequested';
          // For buddy tier, only get requests from direct buddies
          const user = await User.findById(userId).select('buddyPeers').lean<{
            buddyPeers: Array<{ userId: Types.ObjectId }>;
          }>();
          const buddyIds = user?.buddyPeers?.map(buddy => buddy.userId.toString()) || [];

          if (buddyIds.length === 0) {
            return [];
          }

          additionalQuery = {
            userId: { $in: buddyIds.map(id => new Types.ObjectId(id)) }
          };
          break;

        case 'community':
          supportRequestStatus = 'communityRequested';
          // For community tier, get requests from users in same communities
          const userComm = await User.findById(userId).select('communities').lean<{
            communities: Array<{ communityId: Types.ObjectId }>;
          }>();
          const communityIds = userComm?.communities?.map(comm => comm.communityId.toString()) || [];

          if (communityIds.length === 0) {
            return [];
          }

          // Find all users in the same communities
          const communityMembers = await User.find({
            'communities.communityId': { $in: communityIds.map(id => new Types.ObjectId(id)) }
          }).select('_id').lean<CommunityMember[]>();

          const memberIds = communityMembers.map(member => member._id.toString());

          additionalQuery = {
            userId: { $in: memberIds.map(id => new Types.ObjectId(id)) }
          };
          break;

        case 'global':
          supportRequestStatus = 'globalRequested';
          // For global tier, no additional filtering needed
          break;

        default:
          throw new Error(`Invalid tier: ${tier}`);
      }

      // Find active support requests
      const requests = await MentalHealthState.find({
        supportRequestStatus,
        needsSupport: true,
        ...additionalQuery
      })
        .populate({
          path: 'userId',
          select: 'username profile.name'
        })
        .sort({ supportRequestTime: 1 })
        .lean();

      console.log(`[PeerSupport] Found ${requests.length} ${tier} support requests for user ${userId}`);

      return requests;
    } catch (error) {
      console.error(`[PeerSupport] Error getting ${tier} support requests:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const peerSupportService = new PeerSupportService();