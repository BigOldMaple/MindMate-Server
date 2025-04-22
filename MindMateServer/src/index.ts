// server/index.ts
import express, { Response } from 'express';
import http from 'http';
import cors from 'cors';
import { connectToDatabase } from './services/mongodb';
import WebSocketServer from './services/websocketServer';
import authRoutes from './routes/auth';
import mongoose from 'mongoose';
import communityRoutes from './routes/community';
import profileRoutes from './routes/profile';
import buddyPeerRoutes from './routes/buddyPeer';
import chatRoutes from './routes/chat';
import checkInRoutes from './routes/checkIn';
import notificationsRoutes from './routes/notifications';
import configRoutes from './routes/config';
import healthDataRoutes from './routes/healthData'; // Import the health data routes
import { ngrokService } from './services/ngrokService';

// Define a variable for the health sync task manager
// We'll assign it after imports to avoid circular dependencies
let healthSyncTaskManager: any = null;

// Try to import the health sync task manager
try {
    // Import using dynamic import to avoid issues if the file doesn't exist yet
    import('./services/healthSyncTaskManager').then(module => {
        healthSyncTaskManager = module.healthSyncTaskManager;
        console.log('Health sync task manager imported successfully');
    }).catch(err => {
        console.error('Error importing health sync task manager:', err.message);
    });
} catch (err) {
    console.error('Failed to import health sync task manager:', err);
}

const app = express();
const server = http.createServer(app);
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize WebSocket server
const wss = new WebSocketServer(server);

// Very permissive CORS settings for development
const corsOptions = {
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Enhanced debug middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] New Request:`);
    console.log(`Method: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log(`Origin: ${req.headers.origin}`);
    console.log(`User-Agent: ${req.headers['user-agent']}`);
    console.log('Headers:', req.headers);
    if (req.body && Object.keys(req.body).length) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    
    // Log response with proper typing
    const oldSend = res.send;
    res.send = function(this: Response, body: any) {
        console.log(`\nResponse for ${req.url}:`);
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
        return oldSend.call(this, body);
    };

    next();
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/buddy-peer', buddyPeerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/check-in', checkInRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/health-data', healthDataRoutes); // Mount health data routes

// Enhanced health check route with WebSocket info
app.get('/health', (_req, res) => {
    const mongoStatus = mongoose.connection.readyState;
    const statusText = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    const wsClients = wss.getClients().size;
    
    res.json({
        status: 'running',
        timestamp: new Date().toISOString(),
        server: {
            port,
            environment: process.env.NODE_ENV || 'development',
        },
        websocket: {
            status: 'running',
            connectedClients: wsClients
        },
        mongodb: {
            status: statusText[mongoStatus],
            database: mongoose.connection.name,
            host: mongoose.connection.host,
            port: mongoose.connection.port
        }
    });
});

// Basic route for testing
app.get('/', (_req, res) => {
    res.send('Server is running with WebSocket support');
});

// Server initialization
const startServer = async () => {
    try {
        // Connect to MongoDB first
        const db = await connectToDatabase();
        
        if (!db.connection.readyState) {
            throw new Error('Failed to connect to MongoDB');
        }

        // Start server on all network interfaces
        server.listen(port, '0.0.0.0', async () => {
            console.log('\nServer started successfully!');
            console.log('---------------------------');
            console.log(`Port: ${port}`);
            console.log('Server is accessible at:');
            console.log(`  - Local: http://localhost:${port}`);
            console.log(`  - Network: http://139.222.247.9:${port}`);
            console.log(`  - WebSocket: ws://139.222.247.9:${port}/ws`);
            console.log('\nMongoDB Status:');
            console.log(`  - Connection State: ${mongoose.connection.readyState}`);
            console.log(`  - Database: ${mongoose.connection.name}`);
            console.log(`\nWebSocket Status:`);
            console.log(`  - Connected Clients: ${wss.getClients().size}`);
            console.log('\nTest your connection:');
            console.log(`  - Health Check: http://139.222.247.9:${port}/health`);
            console.log('---------------------------\n');
            
            // Start ngrok tunnel using the service
            const ngrokInfo = await ngrokService.startTunnel(port);
            if (ngrokInfo) {
                console.log('\nNgrok Tunnel Information:');
                console.log('---------------------------');
                console.log(`Public URL: ${ngrokInfo.url}`);
                console.log(`WebSocket URL: ${ngrokInfo.wsUrl}/ws`);
                console.log(`Health Check URL: ${ngrokInfo.url}/health`);
                console.log('Copy these URLs to your mobile app configuration.');
                console.log('---------------------------\n');
                
                console.log('\nCopy this code to your apiConfig.ts file:');
                console.log('------------------------------------------');
                console.log(`const NGROK_URL: string | null = '${ngrokInfo.url}';`);
                console.log('------------------------------------------\n');
            }
            
            // Start health data sync task manager if available
            if (healthSyncTaskManager) {
                try {
                    healthSyncTaskManager.startSyncTask(15); // Sync every 15 minutes
                    console.log('\nHealth Data Sync:');
                    console.log('---------------------------');
                    console.log('Health data sync task started');
                    console.log('Sync interval: 15 minutes');
                    console.log('---------------------------\n');
                } catch (error) {
                    console.error('Failed to start health sync task:', error);
                }
            } else {
                console.log('\nHealth data sync task manager not available');
                console.log('Make sure you have created the healthSyncTaskManager.ts file\n');
            }
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown handling
const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    
    // Stop health sync task manager if available
    if (healthSyncTaskManager && typeof healthSyncTaskManager.stopSyncTask === 'function') {
        try {
            healthSyncTaskManager.stopSyncTask();
            console.log('Health sync task stopped');
        } catch (error) {
            console.error('Error stopping health sync task:', error);
        }
    }
    
    // Close ngrok using the service
    try {
        await ngrokService.stopTunnel();
        console.log('Ngrok tunnel closed');
    } catch (error) {
        console.error('Error closing ngrok tunnel:', error);
    }
    
    // Close WebSocket server first
    try {
        await new Promise<void>((resolve) => {
            wss.close(() => {
                console.log('WebSocket server closed');
                resolve();
            });
        });
    } catch (error) {
        console.error('Error closing WebSocket server:', error);
    }

    // Close HTTP server
    server.close(async () => {
        console.log('HTTP server closed');
        
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown();
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
    shutdown();
});

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
startServer().catch((error) => {
    console.error('Startup error:', error);
    process.exit(1);
});