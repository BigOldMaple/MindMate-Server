import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { startServer } from '../MindMateServer/src/index';
import supertest from 'supertest';
import http from 'http';
import { setApiRequest } from './helpers';

// Variables to hold server and database instances
let mongoServer: MongoMemoryServer;
let expressServer: http.Server;

// Set up test environment before running tests
export const setupIntegrationTestEnv = async (enableWebSockets = false) => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Configure environment variables for test
    process.env.MONGODB_URI = mongoUri;
    process.env.JWT_SECRET = 'test-jwt-secret-for-integration';
    process.env.NODE_ENV = 'test';

    // Connect to test database with additional options that help with cleanup
    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        maxPoolSize: 10,
        minPoolSize: 0,
        maxIdleTimeMS: 5000
    });

    // Start Express server with WebSockets enabled if requested
    expressServer = await startServer(true, enableWebSockets);

    // Create supertest instance
    const apiRequest = supertest(expressServer);

    // Use type assertion to fix type compatibility issue
    setApiRequest(apiRequest as any);

    return { apiRequest, expressServer };
};

// Close all open connections for the server
const forceCloseServer = (server: http.Server) => {
    if (!server) return;

    // Close all active connections
    try {
        // Access the internal connections collection (Node.js internals)
        const connections = (server as any)._connections || [];
        for (const socket of Object.values(connections)) {
            try {
                // Force destroy socket
                (socket as any)?.destroy?.();
            } catch (e) {
                // Ignore errors
            }
        }

        // Also try server.closeAllConnections() (Node 16.17.0+ only)
        if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
        }
    } catch (e) {
        console.warn('Error closing server connections:', e);
    }

    // Try regular close
    try {
        server.close();
    } catch (e) {
        // Ignore errors
    }
};

// Improved teardown function
export const teardownIntegrationTestEnv = async () => {
    // Create a single promise that resolves when all cleanup is done or after timeout
    return new Promise<void>(async (mainResolve) => {
        // Set a hard timeout of 6 seconds for the entire teardown
        const hardTimeout = setTimeout(() => {
            console.warn('Teardown timed out - forcing exit');

            // Force close Express server
            forceCloseServer(expressServer);

            // Force mongoose to disconnect
            if (mongoose.connection.readyState !== 0) {
                mongoose.connection.close(false); // Force close
            }

            // Clean references
            expressServer = null as any;
            mongoServer = null as any;

            mainResolve();
        }, 6000);

        try {
            // 1. Close Express server first - use force close with timeout
            if (expressServer) {
                console.log('Closing Express server...');
                try {
                    // First attempt normal close with short timeout
                    const serverClosed = await Promise.race([
                        new Promise<boolean>(resolve => {
                            expressServer.close(() => resolve(true));
                        }),
                        new Promise<boolean>(resolve => {
                            setTimeout(() => {
                                console.warn('Express server close timed out, forcing close');
                                forceCloseServer(expressServer);
                                resolve(false);
                            }, 1000);
                        })
                    ]);

                    if (serverClosed) {
                        console.log('Express server closed gracefully');
                    } else {
                        console.log('Express server force closed');
                    }
                } catch (err) {
                    console.warn('Error closing Express server:', err);
                    forceCloseServer(expressServer);
                }
            }

            // 2. Close all Mongoose connections
            if (mongoose.connection.readyState !== 0) {
                try {
                    await mongoose.connection.close();
                    console.log('MongoDB connections closed successfully');
                } catch (err) {
                    console.warn('Error closing MongoDB connections:', err);

                    // Try force close
                    try {
                        mongoose.connection.close(false);
                    } catch (e) {
                        // Ignore
                    }
                }
            }

            // 3. Stop MongoDB memory server
            if (mongoServer) {
                try {
                    await mongoServer.stop();
                    console.log('MongoMemoryServer stopped successfully');
                } catch (err) {
                    console.warn('Error stopping MongoMemoryServer:', err);
                }
            }

            // Clean references
            expressServer = null as any;
            mongoServer = null as any;

            // Clear hard timeout as we're done
            clearTimeout(hardTimeout);
            mainResolve();
        } catch (error) {
            console.error('Error during teardown:', error);

            // Last resort cleanup
            forceCloseServer(expressServer);

            clearTimeout(hardTimeout);
            mainResolve(); // Resolve anyway to ensure we don't hang
        }
    });
};

// Reset database between tests
export const resetDatabase = async () => {
    try {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            await collections[key].deleteMany({});
        }
    } catch (error) {
        console.error('Error resetting database:', error);
    }
};