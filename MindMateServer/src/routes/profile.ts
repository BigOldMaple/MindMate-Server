// server/routes/profile.ts
import express from 'express';
import { User } from '../Database/Schema';
import { auth } from '../services/auth';

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

// Get user profile
router.get('/', authenticateToken, async (req: any, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-passwordHash')
            .lean();
        
        res.json(user);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Update user profile
router.patch('/', authenticateToken, async (req: any, res) => {
    try {
        const { username, phone, emergencyContact } = req.body;

        // Check if username is taken (if username is being updated)
        if (username && username !== req.user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    username: username || req.user.username,
                    phone: phone || req.user.phone,
                    emergencyContact: emergencyContact || req.user.emergencyContact
                }
            },
            { new: true }
        ).select('-passwordHash');

        res.json(updatedUser);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

export default router;