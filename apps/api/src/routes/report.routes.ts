import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Dataset } from '../models/Dataset';
import { ModelRun } from '../models/ModelRun';
import { ForecastRun } from '../models/ForecastRun';
import { PurchasePlan } from '../models/PurchasePlan';
import { SimulationRun } from '../models/SimulationRun';
import { mlClient } from '../services/mlClient';
import { exportForecastsToCsv, exportReplenishmentToCsv } from '../services/csvExporter';
import { env } from '../config/env';

const router = Router();

// POST trigger PDF report generation
router.post('/generate-pdf', async (req: Request, res: Response) => {
  try {
    const dataset = await Dataset.findOne({ isActive: true }) || await Dataset.findOne().sort({ createdAt: -1 });
    const modelRuns = await ModelRun.find().sort({ 'metrics.test.wape': 1 }).limit(6);
    const simulation = await SimulationRun.findOne().sort({ createdAt: -1 });

    const leaderboard = modelRuns.map(m => ({
      algorithm: m.algorithm.replace(/_/g, ' ').toUpperCase(),
      mae: m.metrics?.test?.mae,
      rmse: m.metrics?.test?.rmse,
      wape: `${Math.round((m.metrics?.test?.wape || 0) * 1000) / 10}%`,
      smape: `${m.metrics?.test?.smape}%`,
      coverage: m.metrics?.test?.intervalCoverage ? `${m.metrics?.test?.intervalCoverage}%` : 'N/A'
    }));

    const simFormatted = simulation ? Object.values(simulation.results).map((s: any) => ({
      policy: s.policyName || s.policyType,
      fillRate: `${s.fillRate}%`,
      stockoutDays: s.stockoutDays,
      unmetUnits: s.unmetDemandUnits,
      totalCost: `₹${s.totalSimulatedCost?.toLocaleString('en-IN')}`
    })) : undefined;

    const summaryData = {
      dataset: dataset ? {
        name: dataset.name,
        rowCount: dataset.rowCount,
        storeCount: dataset.storeCount,
        productCount: dataset.productCount,
        startDate: dataset.startDate,
        endDate: dataset.endDate
      } : {},
      target: dataset?.defaultTarget || 'units_sold',
      leaderboard,
      simulation: simFormatted
    };

    const result = await mlClient.generateReport(summaryData);
    res.json({ success: true, filename: result.filename });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET download PDF report
router.get('/download/:filename', (req: Request, res: Response) => {
  const safeFilename = path.basename(String(req.params.filename));
  const filePath = path.join(env.ARTIFACT_DIR, 'reports', safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: 'Report file not found.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// GET export forecasts as formula-escaped CSV
router.get('/export/forecast-csv', async (req: Request, res: Response) => {
  try {
    const latestForecast = await ForecastRun.findOne().sort({ createdAt: -1 });
    if (!latestForecast || !latestForecast.forecasts.length) {
      return res.status(404).json({ success: false, error: 'No forecasts available to export.' });
    }

    const csvContent = exportForecastsToCsv(latestForecast.forecasts);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quickstock_demand_forecasts_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET export replenishment plan as formula-escaped CSV
router.get('/export/replenishment-csv', async (req: Request, res: Response) => {
  try {
    const { planId } = req.query;
    let plan = planId ? await PurchasePlan.findOne({ planId }) : await PurchasePlan.findOne().sort({ createdAt: -1 });

    if (!plan || !plan.items.length) {
      return res.status(404).json({ success: false, error: 'No replenishment plan available to export.' });
    }

    const csvContent = exportReplenishmentToCsv(plan.items);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quickstock_replenishment_plan_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
