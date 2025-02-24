// server/routes/community.ts
import express from 'express';
import { Community, ICommunity } from '../Database/CommunitySchema';
import { User } from '../Database/Schema';
import { auth } from '../services/auth';
import { ApiError } from '../middleware/error';
import { Types } from 'mongoose';

const router = express.Router();

interface CommunityMember {
    userId: Types.ObjectId;
    role: string;
    joinDate: Date;
}
interface UserProfile {
    name: string;
    isVerifiedProfessional: boolean;
}
interface PopulatedUser {
    _id: Types.ObjectId;
    username: string;
    profile: UserProfile;
}

interface PopulatedCommunity {
    _id: Types.ObjectId;
    name: string;
    description: string;
    type: 'support' | 'professional';
    creator: PopulatedUser;
    members: CommunityMember[];
    createdAt: Date;
    updatedAt: Date;
}

// Define a type for the lean document
type LeanCommunity = {
    _id: Types.ObjectId;
    name: string;
    description: string;
    type: 'support' | 'professional';
    creator: Types.ObjectId;
    members: CommunityMember[];
    createdAt: Date;
    updatedAt: Date;
}

interface EnhancedCommunity extends LeanCommunity {
    memberCount: number;
    isUserMember: boolean;
    userRole: string | null;
}

// Middleware to verify JWT token
const authenticateToken = async (req: any, res: any, next: any) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = auth.verifyToken(token);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Get all communities
router.get('/', authenticateToken, async (req: any, res) => {
    try {
        console.log('Fetching all communities');
        const communities = await Community.find()
            .select('name description type members creator createdAt updatedAt')
            .lean<LeanCommunity[]>();

        // Enhance community data with member counts and other metadata
        const enhancedCommunities = communities.map(community => ({
            ...community,
            memberCount: community.members.length,
            isUserMember: community.members.some((member: CommunityMember) =>
                member.userId.toString() === req.user._id.toString()
            ),
            userRole: community.members.find((member: CommunityMember) =>
                member.userId.toString() === req.user._id.toString()
            )?.role || null
        }));

        console.log(`Found ${communities.length} communities`);
        res.json(enhancedCommunities);
    } catch (error) {
        console.error('Fetch communities error:', error);
        res.status(500).json({ error: 'Failed to fetch communities' });
    }
});

// Create community route
router.post('/', authenticateToken, async (req: any, res) => {
    try {
        const { name, description, type } = req.body;
        const userId = req.user._id;

        if (!name || !description || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const newMember: CommunityMember = {
            userId,
            role: 'admin',
            joinDate: new Date()
        };

        const community = new Community({
            name,
            description,
            type,
            creator: userId,
            members: [newMember]
        });

        await community.save();

        console.log('Community created:', community);
        res.status(201).json(community);
    } catch (error: any) {
        console.error('Create community error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Community name already exists' });
        }
        res.status(500).json({ error: error.message || 'Failed to create community' });
    }
});

// Join community route
router.post('/:communityId/join', authenticateToken, async (req: any, res) => {
    try {
        const { communityId } = req.params;
        const userId = req.user._id;

        // Validate community exists
        const community = await Community.findById(communityId);
        if (!community) {
            throw new ApiError(404, 'Community not found');
        }

        // Check if user is already a member
        const isMember = community.members.some((member: CommunityMember) =>
            member.userId.toString() === userId.toString()
        );

        if (isMember) {
            throw new ApiError(400, 'User is already a member of this community');
        }

        const newMember: CommunityMember = {
            userId,
            role: 'member',
            joinDate: new Date()
        };

        // Add user as a member
        community.members.push(newMember);
        await community.save();

        // Update user's communities array
        await User.findByIdAndUpdate(userId, {
            $push: {
                communities: {
                    communityId: community._id,
                    role: 'member',
                    joinDate: new Date()
                }
            }
        });

        res.json({
            message: 'Successfully joined community',
            community: {
                _id: community._id,
                name: community.name,
                role: 'member',
                joinDate: new Date()
            }
        });
    } catch (error) {
        console.error('Join community error:', error);
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to join community' });
        }
    }
});

// Leave community route
router.post('/:communityId/leave', authenticateToken, async (req: any, res) => {
    try {
        const { communityId } = req.params;
        const userId = req.user._id;

        // Validate community exists
        const community = await Community.findById(communityId);
        if (!community) {
            throw new ApiError(404, 'Community not found');
        }

        // Check if user is a member
        const memberIndex = community.members.findIndex((member: CommunityMember) =>
            member.userId.toString() === userId.toString()
        );

        if (memberIndex === -1) {
            throw new ApiError(400, 'User is not a member of this community');
        }

        // Check if user is the creator/admin
        const isCreator = community.creator.toString() === userId.toString();
        if (isCreator) {
            throw new ApiError(400, 'Community creator cannot leave the community');
        }

        // Remove user from members array
        community.members.splice(memberIndex, 1);
        await community.save();

        // Remove community from user's communities array
        await User.findByIdAndUpdate(userId, {
            $pull: {
                communities: { communityId: community._id }
            }
        });

        res.json({ message: 'Successfully left community' });
    } catch (error) {
        console.error('Leave community error:', error);
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to leave community' });
        }
    }
});

// Search communities route
router.get('/search', authenticateToken, async (req: any, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const searchRegex = new RegExp(query as string, 'i');

        const communities = await Community.find({
            $or: [
                { name: searchRegex },
                { description: searchRegex },
                { type: searchRegex }
            ]
        })
            .select('name description type members creator createdAt updatedAt')
            .lean<LeanCommunity[]>();

        const enhancedCommunities = communities.map(community => ({
            ...community,
            memberCount: community.members.length,
            isUserMember: community.members.some((member: CommunityMember) =>
                member.userId.toString() === req.user._id.toString()
            ),
            userRole: community.members.find((member: CommunityMember) =>
                member.userId.toString() === req.user._id.toString()
            )?.role || null
        }));

        res.json(enhancedCommunities);
    } catch (error) {
        console.error('Search communities error:', error);
        res.status(500).json({ error: 'Failed to search communities' });
    }
});

// Get single community details
router.get('/:communityId', authenticateToken, async (req: any, res) => {
    try {
        const { communityId } = req.params;
        const userId = req.user._id;

        const community = await Community.findById(communityId)
            .populate<{ creator: PopulatedUser }>('creator', 'username profile.name profile.isVerifiedProfessional')
            .populate<{ members: CommunityMember[] }>('members.userId', 'username profile.name profile.isVerifiedProfessional')
            .lean<PopulatedCommunity>();

        if (!community) {
            throw new ApiError(404, 'Community not found');
        }

        const enhancedCommunity = {
            ...community,
            memberCount: community.members.length,
            isUserMember: community.members.some((member: CommunityMember) =>
                member.userId._id.toString() === userId.toString()
            ),
            userRole: community.members.find((member: CommunityMember) =>
                member.userId._id.toString() === userId.toString()
            )?.role || null,
            creatorDetails: community.creator,
            members: community.members.map((member: CommunityMember) => {
                const populatedUser = member.userId as unknown as PopulatedUser;
                return {
                    userId: populatedUser._id,
                    role: member.role,
                    joinDate: member.joinDate,
                    user: {
                        username: populatedUser.username,
                        profile: populatedUser.profile
                    }
                };
            })
        };

        res.json(enhancedCommunity);
    } catch (error) {
        console.error('Get community error:', error);
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to fetch community details' });
        }
    }
});

export default router;