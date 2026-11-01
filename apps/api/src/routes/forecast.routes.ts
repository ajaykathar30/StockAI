import { Router, Request, Response } from 'express';
import { ForecastRun } from '../models/ForecastRun';
import { ModelRun } from '../models/ModelRun';
import { Dataset } from '../models/Dataset';
import { mlClient } from '../services/mlClient';
import { jobQueue } from '../services/jobQueue';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET latest forecast run
router.get('/latest', async (req: Request, res: Response) => {
  try {
    const { storeId, productId, horizonDays } = req.query;

    const activeDataset = await Dataset.findOne({ isActive: true });
    let query: any = {};
    if (activeDataset) {
      const hasDatasetFc = await ForecastRun.exists({ datasetId: activeDataset._id });
      if (hasDatasetFc) {
        query.datasetId = activeDataset._id;
      }
    }
    if (horizonDays) query.horizonDays = parseInt(horizonDays as string, 10);

    const latestRun = await ForecastRun.findOne(query).sort({ createdAt: -1 });
    if (!latestRun) {
      return res.json({ success: true, forecasts: [], summary: null });
    }

    let filteredForecasts = latestRun.forecasts;
    if (storeId && storeId !== 'ALL') {
      filteredForecasts = filteredForecasts.filter(f => f.store_id === storeId);
    }
    if (productId && productId !== 'ALL') {
      filteredForecasts = filteredForecasts.filter(f => f.product_id === productId);
    }

    res.json({
      success: true,
      forecastRunId: latestRun.forecastRunId,
      modelRunId: latestRun.modelRunId,
      target: latestRun.target,
      horizonDays: latestRun.horizonDays,
      summary: latestRun.summary,
      forecasts: filteredForecasts,
      createdAt: latestRun.createdAt
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST generate forecasts (asynchronous background job)
router.post('/run', async (req: Request, res: Response) => {
  try {
    const { horizonDays = 7, modelRunId } = req.body;

    let modelRun = modelRunId ? await ModelRun.findOne({ modelId: modelRunId }) : await ModelRun.findOne({ isActive: true });
    if (!modelRun) {
      modelRun = await ModelRun.findOne().sort({ createdAt: -1 });
    }
    if (!modelRun) {
      return res.status(400).json({ success: false, error: 'No trained model available. Please train a model in Model Lab first.' });
    }

    const dataset = await Dataset.findById(modelRun.datasetId) || await Dataset.findOne({ isActive: true });
    if (!dataset) {
      return res.status(400).json({ success: false, error: 'Dataset not found.' });
    }

    const job = await jobQueue.enqueue('FORECAST', async (jobDoc, updateProgress) => {
      await updateProgress(20, `Loading model artifact and preparing recursive multi-step forecasting (${horizonDays} days)...`);

      const fcRes = await mlClient.generateForecast({
        modelArtifactPath: modelRun.artifactPath,
        datasetPath: dataset.filePath,
        horizonDays: parseInt(horizonDays, 10)
      });

      await updateProgress(70, `Persisting ${fcRes.forecast.forecasts.length} forecast points with uncertainty intervals...`);
      const forecastRunId = `fc_${Date.now()}_${uuidv4().substring(0, 6)}`;

      const forecastRun = await ForecastRun.create({
        forecastRunId,
        modelRunId: modelRun.modelId,
        datasetId: dataset._id,
        target: modelRun.target,
        horizonDays: parseInt(horizonDays, 10),
        summary: fcRes.forecast.summary,
        forecasts: fcRes.forecast.forecasts
      });

      await updateProgress(100, `Forecast generated successfully.`);
      return { forecastRunId, summary: forecastRun.summary };
    });

    res.json({ success: true, jobId: job.jobId, message: 'Demand forecasting job queued.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
