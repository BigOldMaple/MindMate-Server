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
import healthDataRoutes from './routes/healthData';
import mentalHealthRoutes from './routes/mentalHealth';
import { ngrokService } from './services/ngrokService';

// Define a variable for the health sync task manager
let healthSyncTaskManager: any = null;

// Import the health sync task manager (used for updating device sync timestamps)
try {
    import('./services/healthSyncTaskManager').then(module => {
        healthSyncTaskManager = module.healthSyncTaskManager;
        console.log('Health sync task manager imported successfully');
    }).catch(err => {
        console.error('Error importing health sync task manager:', err.message);
    });
} catch (err) {
    console.error('Failed to import health sync task manager:', err);
}

// Function to create an Express app with all routes and middleware
export function createApp(isTest = false) {
    const app = express();
    
    // CORS settings
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
    
    // Skip debug middleware in test mode
    if (!isTest) {
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
    }
    
    // Mount routes
    app.use('/api/auth', authRoutes);
    app.use('/api/community', communityRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/buddy-peer', buddyPeerRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/check-in', checkInRoutes);
    app.use('/api/notifications', notificationsRoutes);
    app.use('/api/config', configRoutes);
    app.use('/api/health-data', healthDataRoutes);
    app.use('/api/mental-health', mentalHealthRoutes);
    
    // Basic route for testing
    app.get('/', (_req, res) => {
        res.send('Server is running with WebSocket support');
    });
    
    return app;
}

// Function to start server, exportable for testing
export const startServer = async (isTest = false, enableWebSockets = false): Promise<http.Server> => {
    try {
        // Connect to MongoDB first
        const db = await connectToDatabase();
        
        if (!db.connection.readyState) {
            throw new Error('Failed to connect to MongoDB');
        }
        
        // Create app
        const app = createApp(isTest);
        const server = http.createServer(app);
        
        // Initialize WebSocket server (skip in test mode unless explicitly enabled)
        let wss: WebSocketServer | undefined;
        if (!isTest || enableWebSockets) {
            wss = new WebSocketServer(server);
        }
        
        // Use dynamic port for tests
        const port = isTest ? 0 : parseInt(process.env.PORT || '3000', 10);
        
        // Add health check route (with or without websocket clients)
        app.get('/health', (_req, res) => {
            const mongoStatus = mongoose.connection.readyState;
            const statusText = ['disconnected', 'connected', 'connecting', 'disconnecting'];
            const serverAddress = server.address();
            const currentPort = typeof serverAddress === 'object' && serverAddress !== null ? 
                serverAddress.port : port;
            
            res.json({
                status: 'running',
                timestamp: new Date().toISOString(),
                server: {
                    port: currentPort,
                    environment: process.env.NODE_ENV || 'development',
                },
                websocket: {
                    status: wss ? 'running' : 'disabled',
                    connectedClients: wss ? wss.getClients().size : 0
                },
                mongodb: {
                    status: statusText[mongoStatus],
                    database: mongoose.connection.name,
                    host: mongoose.connection.host,
                    port: mongoose.connection.port
                }
            });
        });
        
        // Return a Promise that resolves with the server instance
        return new Promise((resolve) => {
            server.listen(port, '0.0.0.0', async () => {
                if (!isTest) {
                    const serverAddress = server.address();
                    const actualPort = typeof serverAddress === 'object' && serverAddress !== null ? 
                                    serverAddress.port : port;
                    
                    console.log('\nServer started successfully!');
                    console.log('---------------------------');
                    console.log(`Port: ${actualPort}`);
                    console.log('Server is accessible at:');
                    console.log(`  - Local: http://localhost:${actualPort}`);
                    console.log(`  - Network: http://139.222.247.9:${actualPort}`);
                    console.log(`  - WebSocket: ws://139.222.247.9:${actualPort}/ws`);
                    console.log('\nMongoDB Status:');
                    console.log(`  - Connection State: ${mongoose.connection.readyState}`);
                    console.log(`  - Database: ${mongoose.connection.name}`);
                    if (wss) {
                        console.log(`\nWebSocket Status:`);
                        console.log(`  - Connected Clients: ${wss.getClients().size}`);
                    }
                    console.log('\nTest your connection:');
                    console.log(`  - Health Check: http://139.222.247.9:${actualPort}/health`);
                    console.log('---------------------------\n');
                    
                    // Start ngrok tunnel
                    try {
                        const ngrokInfo = await ngrokService.startTunnel(actualPort);
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
                    } catch (error) {
                        console.error('Failed to start ngrok tunnel:', error);
                    }
                    
                    // Initialize LLM analysis service
                    try {
                        console.log('\nLLM Analysis Service:');
                        console.log('---------------------------');
                        console.log('Initializing LLM analysis service');
                        console.log('Model: Gemma 3 1B (via Ollama)');
                        console.log('Endpoint: http://localhost:11434/api/generate');
                        console.log('Mental health assessment available at /api/mental-health/assess');
                        console.log('---------------------------\n');
                    } catch (error) {
                        console.error('Failed to initialize LLM analysis service:', error);
                    }
                    
                    // Initialize health sync task manager
                    if (healthSyncTaskManager) {
                        try {
                            healthSyncTaskManager.startSyncTask();
                            console.log('\nHealth Data Sync:');
                            console.log('---------------------------');
                            console.log('Automatic health data sync is disabled');
                            console.log('Manual syncing via app UI is available');
                            console.log('---------------------------\n');
                        } catch (error) {
                            console.error('Failed to initialize health sync task manager:', error);
                        }
                    } else {
                        console.log('\nHealth data sync task manager not available');
                    }
                }
                
                // Resolve the promise with the server instance
                resolve(server);
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        throw error;
    }
};

// Graceful shutdown function - exportable for testing
export const shutdown = async (server: http.Server, wss?: WebSocketServer) => {
    console.log('\nShutting down gracefully...');
    
    // Stop health sync task manager if available
    if (healthSyncTaskManager && typeof healthSyncTaskManager.stopSyncTask === 'function') {
        try {
            healthSyncTaskManager.stopSyncTask();
            console.log('Health sync manager cleaned up');
        } catch (error) {
            console.error('Error stopping health sync manager:', error);
        }
    }
    
    // Close ngrok using the service
    try {
        await ngrokService.stopTunnel();
        console.log('Ngrok tunnel closed');
    } catch (error) {
        console.error('Error closing ngrok tunnel:', error);
    }
    
    // Close WebSocket server if it exists
    if (wss) {
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
    }

    // Return a Promise that resolves when the server is closed
    return new Promise<void>((resolve, reject) => {
        server.close(async (err) => {
            if (err) {
                console.error('Error closing HTTP server:', err);
                reject(err);
                return;
            }
            
            console.log('HTTP server closed');
            
            // Close MongoDB connection
            try {
                await mongoose.connection.close();
                console.log('MongoDB connection closed');
                resolve();
            } catch (dbError) {
                console.error('Error closing MongoDB connection:', dbError);
                reject(dbError);
            }
        });

        // Force close after 10 seconds
        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            reject(new Error('Forced shutdown due to timeout'));
        }, 10000);
    });
};

// Only run this code when the file is executed directly (not imported)
if (require.main === module) {
    // Start the server
    let server: http.Server;
    
    // Error handling
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        if (server) {
            await shutdown(server);
        }
        process.exit(1);
    });

    process.on('unhandledRejection', async (error) => {
        console.error('Unhandled Rejection:', error);
        if (server) {
            await shutdown(server);
        }
        process.exit(1);
    });

    // Handle shutdown signals
    process.on('SIGTERM', async () => {
        if (server) {
            await shutdown(server);
        }
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        if (server) {
            await shutdown(server);
        }
        process.exit(0);
    });
    
    // Start server
    startServer().then(s => {
        server = s;
    }).catch((error) => {
        console.error('Startup error:', error);
        process.exit(1);
    });
}