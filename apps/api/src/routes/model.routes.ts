import { Router, Request, Response } from 'express';
import { ModelRun } from '../models/ModelRun';
import { Dataset } from '../models/Dataset';
import { mlClient } from '../services/mlClient';
import { jobQueue } from '../services/jobQueue';
import { ModelAlgorithm, ForecastTarget } from '@quickstock/shared';

const router = Router();

// GET all model runs (leaderboard)
router.get('/runs', async (req: Request, res: Response) => {
  try {
    const runs = await ModelRun.find().sort({ 'metrics.test.wape': 1, createdAt: -1 });
    res.json({ success: true, runs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET active model run
router.get('/active', async (req: Request, res: Response) => {
  try {
    let run = await ModelRun.findOne({ isActive: true });
    if (!run) {
      run = await ModelRun.findOne().sort({ 'metrics.test.wape': 1 });
    }
    res.json({ success: true, modelRun: run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST train model (asynchronous background job)
router.post('/train', async (req: Request, res: Response) => {
  try {
    const { algorithm = ModelAlgorithm.LIGHTGBM, target = ForecastTarget.UNITS_SOLD, mode = 'quick' } = req.body;

    const dataset = await Dataset.findOne({ isActive: true }) || await Dataset.findOne().sort({ createdAt: -1 });
    if (!dataset) {
      return res.status(400).json({ success: false, error: 'No active dataset found. Please import or generate demo data first.' });
    }

    const job = await jobQueue.enqueue('TRAINING', async (jobDoc, updateProgress) => {
      await updateProgress(10, `Preparing chronological training split for ${algorithm}...`);
      await updateProgress(25, `Extracting time-safe lag and rolling window features...`);

      const mlRes = await mlClient.trainModel({
        datasetPath: dataset.filePath,
        targetCol: target,
        algorithm,
        mode,
        randomSeed: 42
      });

      await updateProgress(80, `Evaluating validation and test metrics on untouched chronological split...`);
      const modelData = mlRes.model;

      // Deactivate other models if this is lightgbm or xgboost
      if ([ModelAlgorithm.LIGHTGBM, ModelAlgorithm.XGBOOST].includes(algorithm as ModelAlgorithm)) {
        await ModelRun.updateMany({}, { isActive: false });
      }

      const modelRun = await ModelRun.create({
        modelId: modelData.modelId,
        datasetId: dataset._id,
        target: modelData.target,
        algorithm: modelData.algorithm,
        hyperparameters: modelData.hyperparameters,
        trainSplitDates: modelData.trainSplitDates,
        metrics: modelData.metrics,
        featureImportance: modelData.featureImportance,
        artifactPath: modelData.artifactPath,
        isActive: true,
        mode
      });

      await updateProgress(100, `Model ${algorithm} trained successfully in ${modelData.elapsedSeconds}s.`);
      return { modelRunId: modelRun.modelId, metrics: modelRun.metrics };
    });

    res.json({ success: true, jobId: job.jobId, message: `Training job queued for ${algorithm}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST activate model run
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    await ModelRun.updateMany({}, { isActive: false });
    const run = await ModelRun.findOneAndUpdate({ modelId: req.params.id }, { isActive: true }, { new: true });
    if (!run) {
      return res.status(404).json({ success: false, error: 'Model run not found.' });
    }
    res.json({ success: true, modelRun: run });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
