// routes/config.ts
import express from 'express';
import { ngrokService } from '../services/ngrokService';

const router = express.Router();

// Get current ngrok URL
router.get('/ngrok-url', async (_req, res) => {
  try {
    const ngrokInfo = await ngrokService.getLatestUrl();
    
    if (!ngrokInfo) {
      return res.status(404).json({ 
        error: 'No ngrok URL available',
        availableAt: '/api/config/ngrok-url'
      });
    }
    
    res.json({
      httpUrl: ngrokInfo.url,
      wsUrl: ngrokInfo.wsUrl + '/ws',
      apiUrl: ngrokInfo.url + '/api',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retrieving ngrok URL:', error);
    res.status(500).json({ error: 'Failed to retrieve ngrok URL' });
  }
});

export default router;