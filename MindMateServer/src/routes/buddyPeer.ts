// server/routes/buddyPeer.ts
import express from 'express';
import { User } from '../Database/Schema';
import { ApiError } from '../middleware/error';
import { auth } from '../services/auth';
import { Types } from 'mongoose';

interface Notification {
    _id: Types.ObjectId;
    type: 'buddy_request' | 'community_invite' | 'system';
    senderId: Types.ObjectId;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: Date;
}

interface BuddyPeer {
    userId: Types.ObjectId;
    relationship: string;
    dateAdded: Date;
}

const router = express.Router();

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

// Get buddy peers
router.get('/', authenticateToken, async (req: any, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('buddyPeers.userId', 'username profile.name')
            .select('buddyPeers');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        interface PopulatedBuddyPeer {
            userId: {
                _id: Types.ObjectId;
                username: string;
                profile: {
                    name: string;
                };
            };
            relationship: string;
            dateAdded: Date;
        }

        const buddyPeers = user.buddyPeers.map((peer: PopulatedBuddyPeer) => ({
            userId: peer.userId._id.toString(),
            username: peer.userId.username,
            name: peer.userId.profile.name,
            relationship: peer.relationship,
            dateAdded: peer.dateAdded
        }));

        res.json(buddyPeers);
    } catch (error) {
        console.error('Get buddy peers error:', error);
        res.status(500).json({ error: 'Failed to fetch buddy peers' });
    }
});

// Get pending buddy requests
router.get('/requests', authenticateToken, async (req: any, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('notifications.senderId', 'username profile.name')
            .select('notifications');

        if (!user || !user.notifications) {
            return res.json([]);
        }

        const pendingRequests = user.notifications
            .filter((notif: Notification) =>
                notif.type === 'buddy_request' &&
                notif.status === 'pending'
            )
            .map((request: any) => ({
                _id: request._id.toString(),
                senderId: request.senderId._id.toString(),
                sender: {
                    username: request.senderId.username,
                    profile: {
                        name: request.senderId.profile.name
                    }
                },
                status: request.status,
                createdAt: request.createdAt
            }));

        res.json(pendingRequests);
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(500).json({ error: 'Failed to fetch buddy requests' });
    }
});

// Search users
router.get('/search', authenticateToken, async (req: any, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const users = await User.find({
            username: new RegExp(query as string, 'i'),
            _id: { $ne: req.user._id }
        })
            .select('username profile.name')
            .limit(10);

        const results = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            name: user.profile.name
        }));

        res.json(results);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Send buddy request
router.post('/request', authenticateToken, async (req: any, res) => {
    try {
        const { username } = req.body;
        const [sender, recipient] = await Promise.all([
            User.findById(req.user._id),
            User.findOne({ username })
        ]);

        if (!recipient) {
            return res.status(404).json({ error: 'User not found' });
        }

        // More robust ObjectID comparison for test environments
        const isAlreadyBuddy = sender.buddyPeers.some((buddy: BuddyPeer) => {
            // Get string representation of both IDs, handling various formats
            const buddyUserId = buddy.userId ?
                (buddy.userId.toString ? buddy.userId.toString() : String(buddy.userId)) : '';

            const recipientId = recipient._id ?
                (recipient._id.toString ? recipient._id.toString() : String(recipient._id)) : '';

            return buddyUserId === recipientId;
        });

        if (isAlreadyBuddy) {
            return res.status(400).json({
                error: 'You are already buddy peers with this user'
            });
        }


        // Check if there's a pending request from sender to recipient
        const existingOutgoingRequest = recipient.notifications?.find(
            (notification: Notification) =>
                notification.type === 'buddy_request' &&
                notification.senderId.toString() === req.user._id.toString() &&
                notification.status === 'pending'
        );

        if (existingOutgoingRequest) {
            return res.status(400).json({ error: 'Buddy request already sent' });
        }

        // Check if there's a pending request from recipient to sender
        const existingIncomingRequest = sender.notifications?.find(
            (notification: Notification) =>
                notification.type === 'buddy_request' &&
                notification.senderId.toString() === recipient._id.toString() &&
                notification.status === 'pending'
        );

        if (existingIncomingRequest) {
            return res.status(400).json({ error: 'This user has already sent you a buddy request' });
        }

        // If all checks pass, add the notification
        await User.findByIdAndUpdate(recipient._id, {
            $push: {
                notifications: {
                    type: 'buddy_request',
                    senderId: req.user._id,
                    status: 'pending',
                    createdAt: new Date()
                }
            }
        });

        res.json({ message: 'Buddy request sent successfully' });
    } catch (error) {
        console.error('Send buddy request error:', error);
        res.status(500).json({ error: 'Failed to send buddy request' });
    }
});

// Respond to buddy request
router.post('/request/:requestId', authenticateToken, async (req: any, res) => {
    try {
        const { requestId } = req.params;
        const { accept } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        const request = user.notifications.id(requestId);
        if (!request || request.type !== 'buddy_request') {
            throw new ApiError(404, 'Request not found');
        }

        if (accept) {
            // Add to both users' buddy peers list
            await Promise.all([
                User.findByIdAndUpdate(req.user._id, {
                    $push: {
                        buddyPeers: {
                            userId: request.senderId,
                            relationship: 'buddy peer',
                            dateAdded: new Date()
                        }
                    }
                }),
                User.findByIdAndUpdate(request.senderId, {
                    $push: {
                        buddyPeers: {
                            userId: req.user._id,
                            relationship: 'buddy peer',
                            dateAdded: new Date()
                        }
                    }
                })
            ]);
        }

        // Update request status
        request.status = accept ? 'accepted' : 'declined';
        await user.save();

        res.json({ message: `Buddy request ${accept ? 'accepted' : 'declined'}` });
    } catch (error) {
        if (error instanceof ApiError) {
            res.status(error.statusCode).json({ error: error.message });
        } else {
            res.status(500).json({ error: 'Failed to respond to buddy request' });
        }
    }
});

// Remove buddy peer
router.delete('/:userId', authenticateToken, async (req: any, res) => {
    try {
        const { userId } = req.params;

        // Remove from both users' buddy peers list
        await Promise.all([
            User.findByIdAndUpdate(req.user._id, {
                $pull: { buddyPeers: { userId } }
            }),
            User.findByIdAndUpdate(userId, {
                $pull: { buddyPeers: { userId: req.user._id } }
            })
        ]);

        res.json({ message: 'Buddy peer removed successfully' });
    } catch (error) {
        console.error('Remove buddy peer error:', error);
        res.status(500).json({ error: 'Failed to remove buddy peer' });
    }
});

// Get buddy profile
router.get('/:userId/profile', authenticateToken, async (req: any, res) => {
    try {
        const { userId } = req.params;

        // Find the buddy in the user's buddy peers list
        const user = await User.findById(req.user._id)
            .populate('buddyPeers.userId', 'username profile.name profile.isVerifiedProfessional profile.organizationAffiliation profile.joinDate');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const buddyPeer = user.buddyPeers.find(
            (buddy: any) => buddy.userId._id.toString() === userId
        );

        if (!buddyPeer) {
            return res.status(404).json({ error: 'Buddy not found' });
        }

        // Mock stats for now - in a real app, you'd calculate these from actual data
        const mockStats = {
            checkIns: Math.floor(Math.random() * 30),
            sessions: Math.floor(Math.random() * 15),
            responseRate: 85 + Math.floor(Math.random() * 15)
        };

        const buddyProfile = {
            userId: buddyPeer.userId._id,
            username: buddyPeer.userId.username,
            name: buddyPeer.userId.profile.name,
            relationship: buddyPeer.relationship,
            dateAdded: buddyPeer.dateAdded,
            profile: {
                isVerifiedProfessional: buddyPeer.userId.profile.isVerifiedProfessional,
                joinDate: buddyPeer.userId.profile.joinDate,
                organizationAffiliation: buddyPeer.userId.profile.organizationAffiliation
            },
            stats: mockStats
        };

        res.json(buddyProfile);
    } catch (error) {
        console.error('Get buddy profile error:', error);
        res.status(500).json({ error: 'Failed to fetch buddy profile' });
    }
});

export default router;