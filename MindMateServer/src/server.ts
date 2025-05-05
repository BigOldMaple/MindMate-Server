// MindMateServer/src/server.ts
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

// Function to create the Express application
export function createApp() {
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
  
  if (process.env.NODE_ENV !== 'test') {
    // Debug middleware - skip in test mode
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
  
  // Health check route
  app.get('/health', (_req, res) => {
    const mongoStatus = mongoose.connection.readyState;
    const statusText = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    res.json({
      status: 'running',
      timestamp: new Date().toISOString(),
      server: {
        environment: process.env.NODE_ENV || 'development',
      },
      mongodb: {
        status: statusText[mongoStatus],
        database: mongoose.connection.name
      }
    });
  });
  
  // Basic route for testing
  app.get('/', (_req, res) => {
    res.send('Server is running with WebSocket support');
  });
  
  return app;
}

// Start the server with optional test mode
export async function startServer(isTest = false) {
  try {
    // Connect to MongoDB first
    const db = await connectToDatabase();
    
    if (!db.connection.readyState) {
      throw new Error('Failed to connect to MongoDB');
    }
    
    const app = createApp();
    const server = http.createServer(app);
    
    // Only initialize WebSocket server if not in test mode
    let wss: WebSocketServer | undefined;
    if (!isTest) {
        wss = new WebSocketServer(server);
    }
    
    const port = isTest ? 0 : parseInt(process.env.PORT || '3000', 10);
    
    return new Promise<http.Server>((resolve) => {
      server.listen(port, '0.0.0.0', () => {
        if (!isTest) {
          const serverAddress = server.address();
          const serverPort = typeof serverAddress === 'object' && serverAddress !== null ? serverAddress.port : port;
          
          console.log('\nServer started successfully!');
          console.log('---------------------------');
          console.log(`Port: ${serverPort}`);
          console.log('Server is accessible at:');
          console.log(`  - Local: http://localhost:${serverPort}`);
          
          if (wss) {
            console.log(`\nWebSocket Status:`);
            console.log(`  - Connected Clients: ${wss.getClients().size}`);
          }
        }
        resolve(server);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
}

// Function to stop the server (for testing purposes)
export async function stopServer(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}