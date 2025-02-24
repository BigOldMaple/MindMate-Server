// services/mongodb.ts
import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/mindmate';

const MONGO_OPTIONS = {
    autoIndex: true, // Build indexes
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    family: 4, // Use IPv4, skip trying IPv6
    connectTimeoutMS: 10000
};

let isConnected = false;

export async function connectToDatabase(): Promise<typeof mongoose> {
    if (isConnected) {
        console.log('Using existing MongoDB connection');
        return mongoose;
    }

    try {
        console.log('Initiating MongoDB connection...');
        
        // Clear any existing connections
        await mongoose.disconnect();
        
        // Connect with new connection
        const db = await mongoose.connect(MONGODB_URI, MONGO_OPTIONS);
        
        isConnected = true;
        console.log('MongoDB Connected Successfully');
        console.log('Connection State:', db.connection.readyState);
        console.log('Database Name:', db.connection.name);
        console.log('Database Host:', db.connection.host);
        
        mongoose.connection.on('connected', () => {
            console.log('MongoDB connection established');
            isConnected = true;
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB connection disconnected');
            isConnected = false;
        });

        return db;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        isConnected = false;
        throw error;
    }
}

export async function disconnectFromDatabase(): Promise<void> {
    if (!isConnected) {
        return;
    }
    
    try {
        await mongoose.disconnect();
        isConnected = false;
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('Error disconnecting from MongoDB:', error);
        throw error;
    }
}

export const db = mongoose.connection;