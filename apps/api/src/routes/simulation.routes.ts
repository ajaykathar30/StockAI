import { Router, Request, Response } from 'express';
import { SimulationRun } from '../models/SimulationRun';
import { Dataset } from '../models/Dataset';
import { ModelRun } from '../models/ModelRun';
import { mlClient } from '../services/mlClient';
import { jobQueue } from '../services/jobQueue';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET latest simulation run
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const run = await SimulationRun.findOne().sort({ createdAt: -1 });
    res.json({ success: true, simulation: run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST run simulation backtest
router.post('/run', async (req: Request, res: Response) => {
  try {
    const {
      leadTimeDays = 2,
      reviewPeriodDays = 1,
      holdingCostRate = 0.05,
      shortagePenaltyRate = 15.0,
      trackPerishability = true,
      defaultShelfLifeDays = 7
    } = req.body;

    const dataset = await Dataset.findOne({ isActive: true }) || await Dataset.findOne().sort({ createdAt: -1 });
    if (!dataset) {
      return res.status(400).json({ success: false, error: 'No dataset found for simulation.' });
    }

    const activeModel = await ModelRun.findOne({ isActive: true });

    const job = await jobQueue.enqueue('SIMULATION', async (jobDoc, updateProgress) => {
      await updateProgress(15, 'Initializing continuous simulated inventory ledger and ground truth...');
      await updateProgress(35, 'Executing Fixed ROP, Moving Average, and QuickStock ML policies...');

      const simRes = await mlClient.simulate({
        datasetPath: dataset.filePath,
        forecastArtifactPath: activeModel?.artifactPath,
        targetCol: dataset.defaultTarget,
        leadTimeDays: parseInt(leadTimeDays, 10),
        reviewPeriodDays: parseInt(reviewPeriodDays, 10),
        holdingCostRate: parseFloat(holdingCostRate),
        shortagePenaltyRate: parseFloat(shortagePenaltyRate),
        trackPerishability: Boolean(trackPerishability),
        defaultShelfLifeDays: parseInt(defaultShelfLifeDays, 10)
      });

      await updateProgress(85, 'Aggregating comparative metrics and daily cost breakdown...');
      const simulationId = `sim_${Date.now()}_${uuidv4().substring(0, 6)}`;

      const simulationRun = await SimulationRun.create({
        simulationId,
        datasetId: dataset._id,
        modelRunId: activeModel?.modelId,
        testStartDate: simRes.simulation.testStartDate,
        testEndDate: simRes.simulation.testEndDate,
        results: simRes.simulation.results,
        assumptions: simRes.simulation.assumptions,
        limitationsDisclaimer: simRes.simulation.limitationsDisclaimer
      });

      await updateProgress(100, 'Policy backtest simulation complete.');
      return { simulationId, resultsSummary: simulationRun.results };
    });

    res.json({ success: true, jobId: job.jobId, message: 'Policy backtesting simulation queued.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
