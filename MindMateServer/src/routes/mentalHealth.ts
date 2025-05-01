// server/routes/mentalHealth.ts
import express from 'express';
import { MentalHealthState, IMentalHealthState } from '../Database/MentalHealthStateSchema';
import { MentalHealthBaseline, IMentalHealthBaseline } from '../Database/MentalHealthBaselineSchema';
import { llmAnalysisService } from '../services/llmAnalysisService';
import { auth } from '../services/auth';
import { peerSupportService } from '../services/peerSupportService';
import { ApiError } from '../middleware/error';
import { Types } from 'mongoose';
import { HealthData } from '../Database/HealthDataSchema';
import { CheckIn } from '../Database/CheckInSchema';

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
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get the latest mental health assessment
router.get('/assessment', authenticateToken, async (req: any, res) => {
  try {
    // Use find with sort and limit instead of the static method
    const assessment = await MentalHealthState.findOne({
      userId: new Types.ObjectId(req.userId)
    })
      .sort({ timestamp: -1 })
      .limit(1);

    if (!assessment) {
      return res.status(404).json({
        error: 'No mental health assessment found',
        message: 'Your first assessment will be created soon. Please continue providing health data through check-ins and connected devices.'
      });
    }

    res.json(assessment);
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Failed to fetch mental health assessment' });
  }
});

// Get the latest baseline
router.get('/baseline', authenticateToken, async (req: any, res) => {
  try {
    const baseline = await MentalHealthBaseline.findOne({
      userId: new Types.ObjectId(req.userId)
    })
      .sort({ establishedAt: -1 })
      .limit(1);

    if (!baseline) {
      return res.status(404).json({
        error: 'No baseline found',
        message: 'You need to establish a baseline first. Use the "Establish Mental Health Baseline" feature.'
      });
    }

    res.json(baseline);
  } catch (error) {
    console.error('Get baseline error:', error);
    res.status(500).json({ error: 'Failed to fetch mental health baseline' });
  }
});

// Trigger a new standard mental health assessment (14-day analysis)
router.post('/assess', authenticateToken, async (req: any, res) => {
  try {
    // Trigger the LLM analysis - using recent analysis as suggested by the available method
    const analysisResult = await llmAnalysisService.analyzeRecentHealth(req.userId);

    // Format response to include key reasoning data
    const response = {
      message: 'Mental health assessment completed',
      status: analysisResult.mentalHealthStatus,
      needsSupport: analysisResult.needsSupport,
      confidenceScore: analysisResult.confidenceScore,
      reasoning: {
        sleepQuality: analysisResult.reasoningData.sleepQuality,
        activityLevel: analysisResult.reasoningData.activityLevel,
        averageMood: analysisResult.reasoningData.checkInMood,
        significantChanges: analysisResult.reasoningData.significantChanges
      },
      analysisType: 'standard'
    };

    res.json(response);
  } catch (error) {
    console.error('Assessment error:', error);
    res.status(500).json({ error: 'Failed to complete mental health assessment' });
  }
});

// Trigger a baseline analysis using all historical data
router.post('/establish-baseline', authenticateToken, async (req: any, res) => {
  try {
    const includeRawData = req.query.includeRawData === 'true';

    // Perform the baseline analysis
    const analysisResult = await llmAnalysisService.establishBaseline(req.userId);

    // Fetch the actual saved baseline document to get the accurate dataPoints
    const savedBaseline = await MentalHealthBaseline.findOne({
      userId: new Types.ObjectId(req.userId)
    }).sort({ establishedAt: -1 }).lean() as IMentalHealthBaseline | null;

    // Format response with special baseline information
    const response: any = {
      message: 'Baseline mental health assessment completed',
      baselineMetrics: {
        sleepQuality: analysisResult.reasoningData.sleepQuality,
        activityLevel: analysisResult.reasoningData.activityLevel,
        averageMoodScore: analysisResult.reasoningData.checkInMood,
        averageStepsPerDay: analysisResult.reasoningData.stepsPerDay,
        exerciseMinutesPerWeek: analysisResult.reasoningData.recentExerciseMinutes ?
          analysisResult.reasoningData.recentExerciseMinutes * 7 / 3 : undefined,
        sleepHours: analysisResult.reasoningData.sleepHours
      },
      dataPoints: savedBaseline?.dataPoints || {
        totalDays: 0,
        daysWithSleepData: 0,
        daysWithActivityData: 0,
        checkInsCount: 0
      },
      confidenceScore: analysisResult.confidenceScore,
      analysisType: 'baseline',
      note: (!savedBaseline || (savedBaseline.dataPoints?.totalDays || 0) < 5) ?
        'Limited historical data available. For more accurate baselines, continue recording health data.' :
        'Baseline established successfully',
      significantPatterns: savedBaseline?.baselineMetrics?.significantPatterns || []
    };

    // If raw data is requested, include it
    if (includeRawData) {
      // Collect raw data that was used for analysis
      const endDate = savedBaseline?.establishedAt || new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - (savedBaseline?.dataPoints?.totalDays || 30));

      // Include the raw data but limit to bare essentials to keep response size manageable
      response.rawData = {
        period: {
          startDate,
          endDate,
          totalDays: savedBaseline?.dataPoints?.totalDays
        },
        healthData: await HealthData.find({
          userId: new Types.ObjectId(req.userId),
          date: { $gte: startDate, $lte: endDate }
        }).select('date sleep summary exercises').sort({ date: -1 }).lean(),

        checkIns: await CheckIn.find({
          userId: new Types.ObjectId(req.userId),
          timestamp: { $gte: startDate, $lte: endDate }
        }).select('timestamp mood notes activities').sort({ timestamp: -1 }).lean()
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Baseline assessment error:', error);
    res.status(500).json({ error: 'Failed to establish mental health baseline' });
  }
});

// Trigger a recent analysis (past 3 days with recency weighting)
router.post('/analyze-recent', authenticateToken, async (req: any, res) => {
  try {
    // Get the baseline for comparison - use proper type assertion
    const baseline = await MentalHealthBaseline.findOne({
      userId: new Types.ObjectId(req.userId)
    })
      .sort({ establishedAt: -1 })
      .lean() as IMentalHealthBaseline | null;

    // Trigger the recent analysis
    const analysisResult = await llmAnalysisService.analyzeRecentHealth(req.userId);

    // Prepare baseline comparison if available
    let baselineComparison = null;
    if (baseline) {
      baselineComparison = {
        sleepChange: compareMetrics(
          analysisResult.reasoningData.sleepQuality,
          baseline.baselineMetrics?.sleepQuality
        ),
        activityChange: compareMetrics(
          analysisResult.reasoningData.activityLevel,
          baseline.baselineMetrics?.activityLevel
        ),
        moodChange: compareMoodScore(
          analysisResult.reasoningData.checkInMood,
          baseline.baselineMetrics?.averageMoodScore
        )
      };
    }

    // Format response for recent analysis
    const response = {
      message: 'Recent mental health assessment completed',
      status: analysisResult.mentalHealthStatus,
      needsSupport: analysisResult.needsSupport,
      confidenceScore: analysisResult.confidenceScore,
      baselineComparison,
      reasoning: {
        sleepQuality: analysisResult.reasoningData.sleepQuality,
        activityLevel: analysisResult.reasoningData.activityLevel,
        averageMood: analysisResult.reasoningData.checkInMood,
        significantChanges: analysisResult.reasoningData.significantChanges
      },
      analysisType: 'recent',
      focusPeriod: '3 days'
    };

    res.json(response);
  } catch (error) {
    console.error('Recent assessment error:', error);
    res.status(500).json({ error: 'Failed to analyze recent mental health data' });
  }
});

// Helper function to compare metrics
function compareMetrics(current: string | undefined, baseline: string | undefined): string | null {
  if (!current || !baseline) return null;

  const qualityScale = {
    'poor': 1,
    'fair': 2,
    'good': 3
  };

  const activityScale = {
    'low': 1,
    'moderate': 2,
    'high': 3
  };

  let currentValue: number, baselineValue: number;

  if (current === 'poor' || current === 'fair' || current === 'good') {
    currentValue = qualityScale[current];
    baselineValue = qualityScale[baseline as 'poor' | 'fair' | 'good'];
  } else {
    currentValue = activityScale[current as 'low' | 'moderate' | 'high'];
    baselineValue = activityScale[baseline as 'low' | 'moderate' | 'high'];
  }

  if (currentValue > baselineValue) {
    return 'Improved compared to baseline';
  } else if (currentValue < baselineValue) {
    return 'Declined compared to baseline';
  } else {
    return 'Consistent with baseline';
  }
}

// Helper function to compare mood scores
function compareMoodScore(current: number | undefined, baseline: number | undefined): string | null {
  if (!current || !baseline) return null;

  const difference = current - baseline;
  const thresholdPct = 0.15; // 15% change threshold

  if (Math.abs(difference) < baseline * thresholdPct) {
    return 'Mood consistent with baseline';
  } else if (difference > 0) {
    const pctImprovement = (difference / baseline * 100).toFixed(0);
    return `Mood improved by ${pctImprovement}% compared to baseline`;
  } else {
    const pctDecline = (Math.abs(difference) / baseline * 100).toFixed(0);
    return `Mood decreased by ${pctDecline}% compared to baseline`;
  }
}

// Get assessment history
router.get('/history', authenticateToken, async (req: any, res) => {
  try {
    const { limit = 10, includeSupportDetails = false, analysisType } = req.query;

    // Build the query
    const query: any = {
      userId: new Types.ObjectId(req.userId)
    };

    // Add analysis type filter if specified
    if (analysisType) {
      query['metadata.analysisType'] = analysisType;
    }

    // Build the query projection
    let projection: any = {
      timestamp: 1,
      mentalHealthStatus: 1,
      confidenceScore: 1,
      needsSupport: 1,
      'reasoningData.sleepQuality': 1,
      'reasoningData.activityLevel': 1,
      'reasoningData.checkInMood': 1,
      'reasoningData.significantChanges': 1,
      'metadata.analysisType': 1
    };

    if (includeSupportDetails === 'true') {
      projection = {
        ...projection,
        supportRequestStatus: 1,
        supportRequestTime: 1,
        supportProvidedBy: 1,
        supportProvidedTime: 1
      };
    }

    const assessments = await MentalHealthState.find(query)
      .select(projection)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json(assessments);
  } catch (error) {
    console.error('Get assessment history error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment history' });
  }
});

// Get baseline history
router.get('/baseline/history', authenticateToken, async (req: any, res) => {
  try {
    const { limit = 5 } = req.query;

    const baselines = await MentalHealthBaseline.find({
      userId: new Types.ObjectId(req.userId)
    })
      .sort({ establishedAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json(baselines);
  } catch (error) {
    console.error('Get baseline history error:', error);
    res.status(500).json({ error: 'Failed to fetch baseline history' });
  }
});

// Get raw analyzed data used in baseline assessment
// Get raw analyzed data used in baseline assessment
router.get('/baseline/analyzed-data', authenticateToken, async (req: any, res) => {
  try {
    // Find the most recent baseline
    const baseline = await MentalHealthBaseline.findOne({
      userId: new Types.ObjectId(req.userId)
    }).sort({ establishedAt: -1 }).lean() as IMentalHealthBaseline | null;
    
    if (!baseline) {
      return res.status(404).json({ error: 'No baseline found' });
    }
    
    // Get the date range used for the baseline
    const endDate = baseline.establishedAt;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (baseline.dataPoints?.totalDays || 30)); // Use recorded days or default to 30
    
    // Fetch the health data for this date range
    const healthData = await HealthData.find({
      userId: new Types.ObjectId(req.userId),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 }).lean();
    
    // Fetch ALL check-ins for this date range without limit
    // IMPORTANT: Don't limit the number of check-ins returned
    const checkIns = await CheckIn.find({
      userId: new Types.ObjectId(req.userId),
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 }).lean();
    
    // Debug logging
    console.log(`[Baseline data] Found ${checkIns.length} check-ins between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    
    res.json({
      analysisType: 'baseline',
      period: {
        startDate,
        endDate,
        totalDays: baseline.dataPoints?.totalDays
      },
      healthData,
      checkIns,
      checkInsCount: {
        displayed: checkIns.length,
        analyzed: baseline.dataPoints?.checkInsCount || 0
      }
    });
  } catch (error) {
    console.error('Get baseline analyzed data error:', error);
    res.status(500).json({ error: 'Failed to fetch baseline analyzed data' });
  }
});

// Get raw analyzed data used in recent assessment
router.get('/recent/analyzed-data', authenticateToken, async (req: any, res) => {
  try {
    // Find the most recent assessment
    const assessment = await MentalHealthState.findOne({
      userId: new Types.ObjectId(req.userId),
      'metadata.analysisType': 'recent'
    }).sort({ timestamp: -1 }).lean() as IMentalHealthState | null;

    if (!assessment) {
      return res.status(404).json({ error: 'No recent assessment found' });
    }

    // Get the date range used for the recent assessment (last 3 days from assessment)
    const endDate = assessment.timestamp;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 3); // Recent analysis uses 3 days

    // Fetch the health data for this date range
    const healthData = await HealthData.find({
      userId: new Types.ObjectId(req.userId),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 }).lean();

    // Fetch check-ins for this date range
    const checkIns = await CheckIn.find({
      userId: new Types.ObjectId(req.userId),
      timestamp: { $gte: startDate, $lte: endDate }
    }).select('timestamp mood notes activities').sort({ timestamp: -1 }).lean();

    res.json({
      analysisType: 'recent',
      period: {
        startDate,
        endDate,
        totalDays: 3
      },
      healthData,
      checkIns
    });
  } catch (error) {
    console.error('Get recent analyzed data error:', error);
    res.status(500).json({ error: 'Failed to fetch recent analyzed data' });
  }
});

// Get assessment statistics
router.get('/stats', authenticateToken, async (req: any, res) => {
  try {
    const { days = 30 } = req.query;

    // Calculate the start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Get assessments for the period
    const assessments = await MentalHealthState.find({
      userId: new Types.ObjectId(req.userId),
      timestamp: { $gte: startDate }
    }).sort({ timestamp: 1 });

    // Calculate statistics
    const statusCounts: Record<string, number> = {
      stable: 0,
      declining: 0,
      critical: 0
    };

    const sleepQualityCounts: Record<string, number> = {
      poor: 0,
      fair: 0,
      good: 0
    };

    const activityLevelCounts: Record<string, number> = {
      low: 0,
      moderate: 0,
      high: 0
    };

    const analysisTypeCounts: Record<string, number> = {
      standard: 0,
      baseline: 0,
      recent: 0
    };

    let totalConfidence = 0;
    let totalMood = 0;
    let moodCount = 0;

    assessments.forEach(assessment => {
      // Count statuses
      const status = assessment.mentalHealthStatus;
      if (status && (status === 'stable' || status === 'declining' || status === 'critical')) {
        statusCounts[status]++;
      }

      // Count sleep qualities
      const sleepQuality = assessment.reasoningData?.sleepQuality;
      if (sleepQuality && (sleepQuality === 'poor' || sleepQuality === 'fair' || sleepQuality === 'good')) {
        sleepQualityCounts[sleepQuality]++;
      }

      // Count activity levels
      const activityLevel = assessment.reasoningData?.activityLevel;
      if (activityLevel && (activityLevel === 'low' || activityLevel === 'moderate' || activityLevel === 'high')) {
        activityLevelCounts[activityLevel]++;
      }

      // Count analysis types
      const analysisType = assessment.metadata?.analysisType || 'standard';
      if (analysisTypeCounts[analysisType] !== undefined) {
        analysisTypeCounts[analysisType]++;
      }

      // Sum confidence scores
      totalConfidence += assessment.confidenceScore;

      // Sum mood scores
      if (assessment.reasoningData?.checkInMood) {
        totalMood += assessment.reasoningData.checkInMood;
        moodCount++;
      }
    });

    // Prepare trends data (last 10 assessments)
    const trendData = assessments.slice(-10).map(assessment => ({
      date: assessment.timestamp,
      status: assessment.mentalHealthStatus,
      confidence: assessment.confidenceScore,
      mood: assessment.reasoningData?.checkInMood,
      analysisType: assessment.metadata?.analysisType || 'standard'
    }));

    // Get the latest baseline - use proper type assertion
    const latestBaseline = await MentalHealthBaseline.findOne({
      userId: new Types.ObjectId(req.userId)
    })
      .sort({ establishedAt: -1 })
      .lean() as IMentalHealthBaseline | null;

    // Prepare response
    const stats = {
      totalAssessments: assessments.length,
      statusDistribution: statusCounts,
      sleepQualityDistribution: sleepQualityCounts,
      activityLevelDistribution: activityLevelCounts,
      analysisTypeDistribution: analysisTypeCounts,
      averageConfidence: assessments.length > 0 ? totalConfidence / assessments.length : 0,
      averageMood: moodCount > 0 ? totalMood / moodCount : 0,
      trends: trendData,
      baseline: latestBaseline ? {
        establishedAt: latestBaseline.establishedAt,
        sleepQuality: latestBaseline.baselineMetrics?.sleepQuality,
        activityLevel: latestBaseline.baselineMetrics?.activityLevel,
        averageMoodScore: latestBaseline.baselineMetrics?.averageMoodScore,
        confidenceScore: latestBaseline.confidenceScore
      } : null,
      period: {
        days: parseInt(days as string),
        startDate,
        endDate: new Date()
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Get assessment stats error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment statistics' });
  }
});

// Update support status (e.g., when a buddy peer provides support)
router.post('/support/:assessmentId', authenticateToken, async (req: any, res) => {
  try {
    const { assessmentId } = req.params;

    // Find the assessment
    const assessment = await MentalHealthState.findById(assessmentId);

    if (!assessment) {
      throw new ApiError(404, 'Assessment not found');
    }

    // Verify that the logged-in user is a buddy peer of the assessment user
    // (This would need a helper function to check buddy peer relationships)
    // For now, we'll skip this check for simplicity

    // Update the support status
    assessment.supportRequestStatus = 'supportProvided';
    assessment.supportProvidedBy = new Types.ObjectId(req.userId);
    assessment.supportProvidedTime = new Date();
    await assessment.save();

    res.json({
      message: 'Support marked as provided',
      assessment
    });
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error('Update support status error:', error);
      res.status(500).json({ error: 'Failed to update support status' });
    }
  }
});

// Get users needing support (for buddies)
router.get('/buddy-support-requests', authenticateToken, async (req: any, res) => {
  try {
    const supportRequests = await peerSupportService.getActiveSupportRequests('buddy', req.userId);
    res.json(supportRequests);
  } catch (error) {
    console.error('Get buddy support requests error:', error);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

// Get community support requests
router.get('/community-support-requests', authenticateToken, async (req: any, res) => {
  try {
    const supportRequests = await peerSupportService.getActiveSupportRequests('community', req.userId);
    res.json(supportRequests);
  } catch (error) {
    console.error('Get community support requests error:', error);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

// Get global support requests
router.get('/global-support-requests', authenticateToken, async (req: any, res) => {
  try {
    const supportRequests = await peerSupportService.getActiveSupportRequests('global', req.userId);
    res.json(supportRequests);
  } catch (error) {
    console.error('Get global support requests error:', error);
    res.status(500).json({ error: 'Failed to fetch support requests' });
  }
});

// Provide support to a user
router.post('/provide-support/:assessmentId', authenticateToken, async (req: any, res) => {
  try {
    const { assessmentId } = req.params;
    
    // Validate assessment ID
    if (!Types.ObjectId.isValid(assessmentId)) {
      return res.status(400).json({ error: 'Invalid assessment ID' });
    }
    
    // Record support provision
    const success = await peerSupportService.recordSupportProvided(
      new Types.ObjectId(assessmentId),
      req.userId
    );
    
    if (!success) {
      return res.status(404).json({ error: 'Assessment not found or support already provided' });
    }
    
    res.json({ message: 'Support provided successfully' });
  } catch (error) {
    console.error('Provide support error:', error);
    res.status(500).json({ error: 'Failed to provide support' });
  }
});

// Get support statistics for the current user
router.get('/support-statistics', authenticateToken, async (req: any, res) => {
  try {
    const { SupportStatistics } = require('../Database/SupportStatisticsSchema');
    
    // Get the user's support statistics
    const stats = await SupportStatistics.findOne({
      userId: new Types.ObjectId(req.userId)
    }).lean();
    
    if (!stats) {
      // If no stats exist yet, return default empty stats
      return res.json({
        providedSupport: {
          total: 0,
          buddyTier: 0,
          communityTier: 0,
          globalTier: 0,
          lastProvidedAt: null
        },
        receivedSupport: {
          total: 0, 
          buddyTier: 0,
          communityTier: 0,
          globalTier: 0,
          lastReceivedAt: null
        },
        supportImpact: 0,
        recentHistory: []
      });
    }
    
    // Calculate support impact score (0-100)
    // This is a simple formula that weights providing support slightly higher
    // In a real implementation, you might have a more sophisticated algorithm
    const providedWeight = 0.6;  // 60% weight for provided support
    const receivedWeight = 0.4;  // 40% weight for received support
    
    const maxSupport = 20; // Cap for normalization
    const normalizedProvided = Math.min(stats.supportProvided.total, maxSupport) / maxSupport;
    const normalizedReceived = Math.min(stats.supportReceived.total, maxSupport) / maxSupport;
    
    const supportImpact = Math.round(
      (normalizedProvided * providedWeight + normalizedReceived * receivedWeight) * 100
    );
    
    // Get the 5 most recent support history entries
    const recentHistory = stats.supportHistory
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
    
    // Format response
    const response = {
      providedSupport: stats.supportProvided,
      receivedSupport: stats.supportReceived,
      supportImpact,
      recentHistory
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get support statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch support statistics' });
  }
});

// Admin route to trigger baseline establishment for a user
router.post('/admin/establish-baseline/:userId', authenticateToken, async (req: any, res) => {
  try {
    // In a real app, add admin role check here

    const { userId } = req.params;
    await llmAnalysisService.establishBaseline(userId);

    res.json({ message: 'Baseline establishment triggered' });
  } catch (error) {
    console.error('Establish baseline error:', error);
    res.status(500).json({ error: 'Failed to establish baseline' });
  }
});

// Admin route to trigger daily analysis
router.post('/admin/run-daily-analysis', authenticateToken, async (req: any, res) => {
  try {
    // In a real app, add admin role check here

    // Start the analysis in the background
    llmAnalysisService.scheduleDailyAnalysis().catch(error => {
      console.error('Error in scheduled analysis:', error);
    });

    res.json({ message: 'Daily analysis started' });
  } catch (error) {
    console.error('Run daily analysis error:', error);
    res.status(500).json({ error: 'Failed to run daily analysis' });
  }
});

// Admin route to clear all mental health assessments for a user (dev only)
router.post('/admin/clear-assessments', authenticateToken, async (req: any, res) => {
  try {
    // In a real app, add admin role check here

    // Delete all mental health assessments for this user
    const result = await MentalHealthState.deleteMany({
      userId: new Types.ObjectId(req.userId)
    });

    // Also clear baselines if requested
    const includeBaselines = req.query.includeBaselines === 'true';
    let baselineResult = { deletedCount: 0 };

    if (includeBaselines) {
      baselineResult = await MentalHealthBaseline.deleteMany({
        userId: new Types.ObjectId(req.userId)
      });
    }

    res.json({
      message: `Cleared ${result.deletedCount} mental health assessments${includeBaselines ? ` and ${baselineResult.deletedCount} baselines` : ''
        }`,
      assessmentCount: result.deletedCount,
      baselineCount: baselineResult.deletedCount
    });
  } catch (error) {
    console.error('Clear assessments error:', error);
    res.status(500).json({ error: 'Failed to clear mental health assessments' });
  }
});
// Get analyzed data for a specific assessment
router.get('/assessment/:assessmentId/analyzed-data', authenticateToken, async (req: any, res) => {
  try {
    const { assessmentId } = req.params;
    
    // Validate that we have a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(assessmentId)) {
      return res.status(400).json({ error: 'Invalid assessment ID' });
    }
    
    // Find the assessment to get the date range
    const assessment = await MentalHealthState.findOne({
      _id: new Types.ObjectId(assessmentId),
      userId: new Types.ObjectId(req.userId)
    });
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    
    // Get the date range that was analyzed for this assessment
    // Default to 3 days before the assessment for standard assessments
    const endDate = new Date(assessment.timestamp);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 3); // Default 3 days
    
    // If the assessment has metadata about the actual period analyzed, use that
    if (assessment.metadata && assessment.metadata.analyzedPeriod) {
      if (assessment.metadata.analyzedPeriod.startDate) {
        startDate.setTime(new Date(assessment.metadata.analyzedPeriod.startDate).getTime());
      }
      
      if (assessment.metadata.analyzedPeriod.endDate) {
        endDate.setTime(new Date(assessment.metadata.analyzedPeriod.endDate).getTime());
      }
    }
    
    // Fetch health data for this period
    const healthData = await HealthData.find({
      userId: new Types.ObjectId(req.userId),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 }).lean();
    
    // Fetch check-ins for this period
    const checkIns = await CheckIn.find({
      userId: new Types.ObjectId(req.userId),
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 }).lean();
    
    // Return the data
    res.json({
      analysisType: assessment.metadata?.analysisType || 'standard',
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      healthData,
      checkIns
    });
  } catch (error) {
    console.error('Get assessment analyzed data error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment analyzed data' });
  }
});

// Get analyzed data for a specific baseline
router.get('/baseline/:baselineId/analyzed-data', authenticateToken, async (req: any, res) => {
  try {
    const { baselineId } = req.params;
    
    // Validate that we have a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(baselineId)) {
      return res.status(400).json({ error: 'Invalid baseline ID' });
    }
    
    // Find the baseline to get the date range
    const baseline = await MentalHealthBaseline.findOne({
      _id: new Types.ObjectId(baselineId),
      userId: new Types.ObjectId(req.userId)
    });
    
    if (!baseline) {
      return res.status(404).json({ error: 'Baseline not found' });
    }
    
    // Get the date range for this baseline
    const endDate = new Date(baseline.establishedAt);
    const startDate = new Date(endDate);
    
    // If dataPoints has totalDays, use that to determine the start date
    if (baseline.dataPoints && baseline.dataPoints.totalDays) {
      startDate.setDate(startDate.getDate() - baseline.dataPoints.totalDays);
    } else {
      // Default to 30 days for baselines
      startDate.setDate(startDate.getDate() - 30);
    }
    
    // Fetch health data for this period
    const healthData = await HealthData.find({
      userId: new Types.ObjectId(req.userId),
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 }).lean();
    
    // Fetch check-ins for this period
    const checkIns = await CheckIn.find({
      userId: new Types.ObjectId(req.userId),
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 }).lean();
    
    // Return the data with information about what was analyzed vs what is displayed
    res.json({
      analysisType: 'baseline',
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: baseline.dataPoints?.totalDays || Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      healthData,
      checkIns,
      checkInsCount: {
        displayed: checkIns.length,
        analyzed: baseline.dataPoints?.checkInsCount || checkIns.length
      }
    });
  } catch (error) {
    console.error('Get baseline analyzed data error:', error);
    res.status(500).json({ error: 'Failed to fetch baseline analyzed data' });
  }
});
export default router;