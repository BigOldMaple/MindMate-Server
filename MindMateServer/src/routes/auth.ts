import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../Database/Schema';
import { auth } from '../services/auth';

const router = express.Router();

// Type for custom error
interface DatabaseError {
    message: string;
}

// Helper function to check if error is DatabaseError
function isDatabaseError(error: unknown): error is DatabaseError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as DatabaseError).message === 'string'
    );
}

router.post('/register', async (req, res) => {
    try {
        console.log('Registration request received:', req.body);
        const { username, email, password, name } = req.body;

        // Input Validation
        if (!username || !email || !password || !name) {
            console.log('Missing required fields');
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check MongoDB connection
        if (!User) {
            console.error('User model is not defined');
            return res.status(500).json({ error: 'Database not initialized' });
        }

        try {
            // Check existing username
            console.log('Checking for existing username:', username);
            const existingUsername = await User.findOne({ username: username.trim() });
            if (existingUsername) {
                return res.status(409).json({ error: 'Username already taken' });
            }

            // Check existing email
            console.log('Checking for existing email:', email);
            const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
            if (existingEmail) {
                return res.status(409).json({ error: 'Email already registered' });
            }

            // Hash password
            console.log('Hashing password...');
            const passwordHash = await bcrypt.hash(password, 10);

            // Create new user
            console.log('Creating new user...');
            const newUser = new User({
                username: username.trim(),
                email: email.toLowerCase().trim(),
                passwordHash,
                profile: { 
                    name,
                    joinDate: new Date(),
                    isVerifiedProfessional: false,
                    verificationDocuments: []
                }
            });

            console.log('Saving user to database...');
            await newUser.save();

            // Generate token
            console.log('Generating auth token...');
            const token = auth.createAuthToken(newUser._id.toString());

            console.log('Registration successful');
            return res.status(201).json({
                token,
                user: {
                    id: newUser._id.toString(),
                    username: newUser.username,
                    email: newUser.email,
                    profile: {
                        name: newUser.profile.name,
                        isVerifiedProfessional: false
                    }
                }
            });
        } catch (dbError) {
            console.error('Database operation error:', dbError);
            return res.status(500).json({ 
                error: 'Database operation failed',
                details: isDatabaseError(dbError) ? dbError.message : 'Unknown database error'
            });
        }
    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            error: 'Registration failed',
            details: isDatabaseError(error) ? error.message : 'Unknown error occurred'
        });
    }
});

router.post('/login', async (req, res) => {
    try {
        console.log('Login request received:', { email: req.body.email });
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        // Check MongoDB connection
        if (!User) {
            console.error('User model is not defined');
            return res.status(500).json({ error: 'Database not initialized' });
        }

        try {
            const user = await User.findOne({ email: email.toLowerCase().trim() });
            
            if (!user) {
                return res.status(401).json({ error: 'Account not found' });
            }

            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Incorrect password' });
            }

            const token = auth.createAuthToken(user._id.toString());

            console.log('Login successful for user:', user.email);
            return res.json({
                token,
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    email: user.email,
                    profile: {
                        name: user.profile.name,
                        isVerifiedProfessional: user.profile.isVerifiedProfessional
                    }
                }
            });
        } catch (dbError) {
            console.error('Database operation error:', dbError);
            return res.status(500).json({ 
                error: 'Database operation failed',
                details: isDatabaseError(dbError) ? dbError.message : 'Unknown database error'
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            error: 'Login failed',
            details: isDatabaseError(error) ? error.message : 'Unknown error occurred'
        });
    }
});

export default router;