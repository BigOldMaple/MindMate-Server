// src/services/__tests__/peerSupportService.test.ts
import { Types } from 'mongoose';
import { peerSupportService } from '../peerSupportService';
import { User } from '../../Database/Schema';
import { MentalHealthState } from '../../Database/MentalHealthStateSchema';
import { Notification } from '../../Database/NotificationSchema';
import { pushNotificationService } from '../pushNotificationService';

// Mock dependencies
jest.mock('../../Database/Schema');
jest.mock('../../Database/MentalHealthStateSchema');
jest.mock('../../Database/NotificationSchema');
jest.mock('../pushNotificationService');
jest.mock('../../Database/SupportStatisticsSchema', () => {
  return {
    SupportStatistics: {
      findOne: jest.fn(),
    }
  };
});

describe('Peer Support Service', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock setTimeout and clearTimeout
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initiateSupportRequest', () => {
    it('should update assessment status to communityRequested when user has no buddies', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();
      
      // Mock User.findById to return a user with no buddies
      const mockUser = {
        _id: userId,
        buddyPeers: [],
        communities: [],
      };
      
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockUser)
          })
        })
      });
      
      // Mock MentalHealthState.findByIdAndUpdate
      (MentalHealthState.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      
      // Spy on requestCommunitySupport
      const requestCommunitySpy = jest.spyOn(
        peerSupportService as any, 
        'requestCommunitySupport'
      ).mockResolvedValue(undefined);
      
      // Execute
      await peerSupportService.initiateSupportRequest(userId, assessmentId);
      
      // Verify
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(MentalHealthState.findByIdAndUpdate).toHaveBeenCalledWith(
        assessmentId,
        {
          $set: {
            supportRequestStatus: 'communityRequested',
            supportRequestTime: expect.any(Date)
          }
        }
      );
      expect(requestCommunitySpy).toHaveBeenCalledWith(
        userId, 
        assessmentId, 
        []
      );
      
      // Restore spy
      requestCommunitySpy.mockRestore();
    });

    it('should update assessment status to buddyRequested when user has buddies', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();
      const buddyId = new Types.ObjectId();
      
      // Mock User.findById to return a user with buddies
      const mockUser = {
        _id: userId,
        buddyPeers: [
          { 
            userId: {
              _id: buddyId
            },
            relationship: 'buddy peer',
            dateAdded: new Date()
          }
        ],
        communities: []
      };
      
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockUser)
          })
        })
      });
      
      // Mock MentalHealthState.findByIdAndUpdate
      (MentalHealthState.findByIdAndUpdate as jest.Mock).mockResolvedValue({});
      
      // Spy on notifyBuddyPeers and scheduleEscalation
      const notifyBuddySpy = jest.spyOn(
        peerSupportService as any, 
        'notifyBuddyPeers'
      ).mockResolvedValue(undefined);
      
      const scheduleEscalationSpy = jest.spyOn(
        peerSupportService as any, 
        'scheduleEscalation'
      ).mockImplementation(jest.fn());
      
      // Execute
      await peerSupportService.initiateSupportRequest(userId, assessmentId);
      
      // Verify
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(MentalHealthState.findByIdAndUpdate).toHaveBeenCalledWith(
        assessmentId,
        {
          $set: {
            supportRequestStatus: 'buddyRequested',
            supportRequestTime: expect.any(Date)
          }
        }
      );
      expect(notifyBuddySpy).toHaveBeenCalledWith(
        userId, 
        assessmentId, 
        [buddyId.toString()]
      );
      expect(scheduleEscalationSpy).toHaveBeenCalledWith(
        userId,
        assessmentId,
        'buddy',
        []
      );
      
      // Restore spies
      notifyBuddySpy.mockRestore();
      scheduleEscalationSpy.mockRestore();
    });
  });

  describe('notifyBuddyPeers', () => {
    it('should create notifications for all buddies', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();
      const buddyIds = [
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString()
      ];
      
      // Mock Notification constructor and save method
      const mockNotification = {
        save: jest.fn().mockResolvedValue(true)
      };
      
      (Notification as jest.MockedClass<typeof Notification>)
        .mockImplementation(() => mockNotification as any);
      
      // Mock pushNotificationService.sendToUser
      (pushNotificationService.sendToUser as jest.Mock).mockResolvedValue(true);
      
      // Execute
      await (peerSupportService as any).notifyBuddyPeers(userId, assessmentId, buddyIds);
      
      // Verify
      expect(Notification).toHaveBeenCalledTimes(buddyIds.length);
      expect(mockNotification.save).toHaveBeenCalledTimes(buddyIds.length);
      expect(pushNotificationService.sendToUser).toHaveBeenCalledTimes(buddyIds.length);
      
      // Check first buddy notification
      expect(Notification).toHaveBeenCalledWith(expect.objectContaining({
        userId: expect.any(Types.ObjectId),
        type: 'support',
        title: 'Support Request',
        actionable: true,
        actionRoute: '/buddy-support',
        relatedId: assessmentId
      }));
      
      // Verify push notification
      expect(pushNotificationService.sendToUser).toHaveBeenCalledWith(
        expect.any(String),
        'Support Request',
        'Someone in your support network might need help',
        expect.objectContaining({
          type: 'support',
          actionRoute: '/buddy-support',
          relatedId: assessmentId
        })
      );
    });
    
    it('should handle invalid buddy IDs gracefully', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();
      const buddyIds = [
        'invalid-id', // Invalid ID format
        new Types.ObjectId().toString() // Valid ID
      ];
      
      // Mock Notification constructor and save method
      const mockNotification = {
        save: jest.fn().mockResolvedValue(true)
      };
      
      (Notification as jest.MockedClass<typeof Notification>)
        .mockImplementation(() => mockNotification as any);
      
      // Mock pushNotificationService.sendToUser
      (pushNotificationService.sendToUser as jest.Mock).mockResolvedValue(true);
      
      // Execute
      await (peerSupportService as any).notifyBuddyPeers(userId, assessmentId, buddyIds);
      
      // Verify - should only process the valid ID
      expect(Notification).toHaveBeenCalledTimes(1);
      expect(mockNotification.save).toHaveBeenCalledTimes(1);
      expect(pushNotificationService.sendToUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleEscalation', () => {
    it('should set timeout that calls requestCommunitySupport after BUDDY_TIER_TIMEOUT_MS', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();
      const communities: any[] = [];
      
      // Mock MentalHealthState.findById for when the timeout expires
      // Important: Create a chain of method mocks to match the actual implementation
      const mockAssessment = {
        _id: assessmentId,
        supportRequestStatus: 'buddyRequested'
      };
      
      const leanMock = jest.fn().mockResolvedValue(mockAssessment);
      (MentalHealthState.findById as jest.Mock).mockReturnValue({
        lean: leanMock
      });
      
      // Spy on requestCommunitySupport
      const requestCommunitySpy = jest.spyOn(
        peerSupportService as any, 
        'requestCommunitySupport'
      ).mockResolvedValue(undefined);
      
      // Execute
      (peerSupportService as any).scheduleEscalation(
        userId, 
        assessmentId, 
        'buddy', 
        communities
      );
      
      // Run timers - simulate BUDDY_TIER_TIMEOUT_MS passing
      jest.runAllTimers();
      
      // Allow pending promises to resolve
      await Promise.resolve();
      
      // Verify
      expect(MentalHealthState.findById).toHaveBeenCalledWith(assessmentId);
      expect(leanMock).toHaveBeenCalled();
      expect(requestCommunitySpy).toHaveBeenCalledWith(
        userId, 
        assessmentId, 
        communities
      );
      
      // Restore spy
      requestCommunitySpy.mockRestore();
    });
    
    it('should not escalate if support has already been provided', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();
      const communities: any[] = [];
      
      // Mock MentalHealthState.findById to return an assessment with status already set to supportProvided
      const mockAssessment = {
        _id: assessmentId,
        supportRequestStatus: 'supportProvided'
      };
      
      // Mock the chain of method calls
      const leanMock = jest.fn().mockResolvedValue(mockAssessment);
      (MentalHealthState.findById as jest.Mock).mockReturnValue({
        lean: leanMock
      });
      
      // Spy on requestCommunitySupport
      const requestCommunitySpy = jest.spyOn(
        peerSupportService as any, 
        'requestCommunitySupport'
      ).mockResolvedValue(undefined);
      
      // Execute
      (peerSupportService as any).scheduleEscalation(
        userId, 
        assessmentId, 
        'buddy', 
        communities
      );
      
      // Run timers
      jest.runAllTimers();
      
      // Allow pending promises to resolve
      await Promise.resolve();
      
      // Verify
      expect(MentalHealthState.findById).toHaveBeenCalledWith(assessmentId);
      expect(leanMock).toHaveBeenCalled();
      expect(requestCommunitySpy).not.toHaveBeenCalled();
      
      // Restore spy
      requestCommunitySpy.mockRestore();
    });
  });

  describe('recordSupportProvided', () => {
    it('should update assessment status to supportProvided and update statistics', async () => {
      // Setup
      const assessmentId = new Types.ObjectId();
      const providerId = new Types.ObjectId().toString();
      const userId = new Types.ObjectId().toString();
      
      // Mock MentalHealthState.findById
      const mockAssessment = {
        _id: assessmentId,
        userId: new Types.ObjectId(userId),
        supportRequestStatus: 'buddyRequested',
        supportProvidedBy: null,
        supportProvidedTime: null,
        save: jest.fn().mockResolvedValue(true)
      };
      
      // Direct mock since lean() isn't used for this method
      (MentalHealthState.findById as jest.Mock).mockResolvedValue(mockAssessment);
      
      // Spy on updateSupportStatisticsWithTier and notifySupportProvided
      const updateStatsSpy = jest.spyOn(
        peerSupportService as any, 
        'updateSupportStatisticsWithTier'
      ).mockResolvedValue(undefined);
      
      const notifySpy = jest.spyOn(
        peerSupportService as any, 
        'notifySupportProvided'
      ).mockResolvedValue(undefined);
      
      // Execute
      const result = await peerSupportService.recordSupportProvided(assessmentId, providerId);
      
      // Verify
      expect(result).toBe(true);
      expect(MentalHealthState.findById).toHaveBeenCalledWith(assessmentId);
      expect(mockAssessment.supportRequestStatus).toBe('supportProvided');
      expect(mockAssessment.supportProvidedBy).toEqual(expect.any(Types.ObjectId));
      expect(mockAssessment.supportProvidedTime).toEqual(expect.any(Date));
      expect(mockAssessment.save).toHaveBeenCalled();
      
      expect(updateStatsSpy).toHaveBeenCalledWith(
        assessmentId,
        providerId,
        'buddy' // This is determined from the 'buddyRequested' status
      );
      
      expect(notifySpy).toHaveBeenCalledWith(userId, providerId);
      
      // Restore spies
      updateStatsSpy.mockRestore();
      notifySpy.mockRestore();
    });
    
    it('should return false when assessment not found', async () => {
      // Setup
      const assessmentId = new Types.ObjectId();
      const providerId = new Types.ObjectId().toString();
      
      // Mock MentalHealthState.findById to return null
      (MentalHealthState.findById as jest.Mock).mockResolvedValue(null);
      
      // Execute
      const result = await peerSupportService.recordSupportProvided(assessmentId, providerId);
      
      // Verify
      expect(result).toBe(false);
      expect(MentalHealthState.findById).toHaveBeenCalledWith(assessmentId);
    });
  });

  describe('getActiveSupportRequests', () => {
    it('should return list of active support requests from buddies', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      const buddyId1 = new Types.ObjectId();
      const buddyId2 = new Types.ObjectId();
      
      // Mock User.findById to return user with buddies
      const mockUser = {
        buddyPeers: [
          { userId: buddyId1 },
          { userId: buddyId2 }
        ]
      };
      
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser)
        })
      });
      
      // Mock support requests with proper method chaining
      const mockRequests = [
        {
          _id: new Types.ObjectId(),
          userId: buddyId1,
          supportRequestStatus: 'buddyRequested',
          needsSupport: true
        }
      ];
      
      const leanMock = jest.fn().mockResolvedValue(mockRequests);
      const sortMock = jest.fn().mockReturnValue({ lean: leanMock });
      const populateMock = jest.fn().mockReturnValue({ sort: sortMock });
      
      (MentalHealthState.find as jest.Mock).mockReturnValue({
        populate: populateMock
      });
      
      // Execute
      const result = await peerSupportService.getActiveSupportRequests('buddy', userId);
      
      // Verify
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(MentalHealthState.find).toHaveBeenCalledWith({
        supportRequestStatus: 'buddyRequested',
        needsSupport: true,
        userId: { $in: expect.arrayContaining([expect.any(Types.ObjectId)]) }
      });
      expect(populateMock).toHaveBeenCalled();
      expect(sortMock).toHaveBeenCalled();
      expect(leanMock).toHaveBeenCalled();
      expect(result).toEqual(mockRequests);
    });
    
    it('should return empty array when user has no buddies', async () => {
      // Setup
      const userId = new Types.ObjectId().toString();
      
      // Mock User.findById to return user with no buddies
      const mockUser = {
        buddyPeers: []
      };
      
      (User.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser)
        })
      });
      
      // Execute
      const result = await peerSupportService.getActiveSupportRequests('buddy', userId);
      
      // Verify
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(MentalHealthState.find).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
});