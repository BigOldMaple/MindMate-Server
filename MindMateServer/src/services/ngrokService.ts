// services/ngrokService.ts
import ngrok from 'ngrok';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

// Schema for storing the ngrok URL
const ngrokSchema = new mongoose.Schema({
  url: String,
  wsUrl: String,
  createdAt: { type: Date, default: Date.now }
});

// Get or create the model
const NgrokUrl = mongoose.models.NgrokUrl || mongoose.model('NgrokUrl', ngrokSchema);

class NgrokService {
  private static instance: NgrokService;
  private currentUrl: string | null = null;
  private currentWsUrl: string | null = null;

  private constructor() {}

  public static getInstance(): NgrokService {
    if (!NgrokService.instance) {
      NgrokService.instance = new NgrokService();
    }
    return NgrokService.instance;
  }

  public async startTunnel(port: number): Promise<{ url: string; wsUrl: string } | null> {
    try {
      // Set auth token if available
      if (process.env.NGROK_AUTHTOKEN) {
        await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);
      }

      // Start ngrok
      const url = await ngrok.connect({
        addr: port,
        region: 'eu',  // Use 'us', 'eu', 'au', 'ap', 'in' based on your location
      });

      const wsUrl = url.replace('https://', 'wss://').replace('http://', 'ws://');
      
      // Store URLs
      this.currentUrl = url;
      this.currentWsUrl = wsUrl;

      // Save to database
      await this.saveUrlToDb(url, wsUrl);
      
      // Save to a json file as backup
      this.saveUrlToFile(url, wsUrl);

      console.log('\nNgrok Tunnel Information:');
      console.log('------------------------');
      console.log(`Public URL: ${url}`);
      console.log(`WebSocket URL: ${wsUrl}/ws`);
      console.log('------------------------\n');

      return { url, wsUrl };
    } catch (error) {
      console.error('Error starting ngrok:', error);
      return null;
    }
  }

  private async saveUrlToDb(url: string, wsUrl: string): Promise<void> {
    try {
      // Save new URL to database
      const ngrokUrl = new NgrokUrl({
        url,
        wsUrl,
        createdAt: new Date()
      });
      await ngrokUrl.save();

      // Keep only the last 5 URLs
      const oldUrls = await NgrokUrl.find().sort({ createdAt: -1 }).skip(5);
      if (oldUrls.length > 0) {
        const oldUrlIds = oldUrls.map(doc => doc._id);
        await NgrokUrl.deleteMany({ _id: { $in: oldUrlIds } });
      }
    } catch (error) {
      console.error('Error saving ngrok URL to database:', error);
    }
  }

  private saveUrlToFile(url: string, wsUrl: string): void {
    try {
      const filePath = path.join(__dirname, '../../ngrok-url.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ 
          url, 
          wsUrl,
          timestamp: new Date().toISOString() 
        }, null, 2)
      );
    } catch (error) {
      console.error('Error saving ngrok URL to file:', error);
    }
  }

  public async getLatestUrl(): Promise<{ url: string; wsUrl: string } | null> {
    // First check in-memory cache
    if (this.currentUrl && this.currentWsUrl) {
      return { url: this.currentUrl, wsUrl: this.currentWsUrl };
    }

    // Then try database
    try {
      const latestUrl = await NgrokUrl.findOne().sort({ createdAt: -1 });
      if (latestUrl) {
        return { url: latestUrl.url, wsUrl: latestUrl.wsUrl };
      }
    } catch (error) {
      console.error('Error fetching ngrok URL from database:', error);
    }

    // Finally try file
    try {
      const filePath = path.join(__dirname, '../../ngrok-url.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { url: data.url, wsUrl: data.wsUrl };
      }
    } catch (error) {
      console.error('Error reading ngrok URL from file:', error);
    }

    return null;
  }

  public async stopTunnel(): Promise<void> {
    try {
      await ngrok.kill();
      console.log('Ngrok tunnel closed');
    } catch (error) {
      console.error('Error stopping ngrok tunnel:', error);
    }
  }
}

export const ngrokService = NgrokService.getInstance();