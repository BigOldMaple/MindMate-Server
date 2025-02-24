import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const auth = {
    verifyToken(token: string): { userId: string } {
        try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            return decoded;
        } catch (error) {
            throw new Error('Invalid token');
        }
    },

    createAuthToken(userId: string): string {
        return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    }
};