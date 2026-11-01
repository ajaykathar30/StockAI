import { Router, Request, Response } from 'express';
import { Dataset } from '../models/Dataset';
import { StoreProduct } from '../models/StoreProduct';
import { ModelRun } from '../models/ModelRun';
import { ForecastRun } from '../models/ForecastRun';
import { PurchasePlan } from '../models/PurchasePlan';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const dataset = await Dataset.findOne({ isActive: true }) || await Dataset.findOne().sort({ createdAt: -1 });
    let storeProducts: any[] = [];
    if (dataset) {
      storeProducts = await StoreProduct.find({ datasetId: dataset._id });
    }
    if (!storeProducts.length) {
      storeProducts = await StoreProduct.find();
    }

    let activeModel = null;
    if (dataset) {
      activeModel = await ModelRun.findOne({ datasetId: dataset._id, isActive: true })
        || await ModelRun.findOne({ datasetId: dataset._id }).sort({ createdAt: -1 });
    }
    if (!activeModel) {
      activeModel = await ModelRun.findOne({ isActive: true }) || await ModelRun.findOne().sort({ createdAt: -1 });
    }

    let latestForecast = null;
    if (dataset) {
      latestForecast = await ForecastRun.findOne({ datasetId: dataset._id }).sort({ createdAt: -1 });
      if (!latestForecast && activeModel?.datasetId) {
        latestForecast = await ForecastRun.findOne({ datasetId: activeModel.datasetId }).sort({ createdAt: -1 });
      }
    }
    if (!latestForecast) {
      latestForecast = await ForecastRun.findOne().sort({ createdAt: -1 });
    }

    let latestPlan = null;
    if (dataset) {
      latestPlan = await PurchasePlan.findOne({ datasetId: dataset._id }).sort({ createdAt: -1 });
      if (!latestPlan && activeModel?.datasetId) {
        latestPlan = await PurchasePlan.findOne({ datasetId: activeModel.datasetId }).sort({ createdAt: -1 });
      }
    }
    if (!latestPlan) {
      latestPlan = await PurchasePlan.findOne().sort({ createdAt: -1 });
    }

    const totalStores = new Set(storeProducts.map(sp => sp.store_id)).size;
    const totalProducts = new Set(storeProducts.map(sp => sp.product_id)).size;

    let totalInventoryUnits = 0;
    let totalInventoryValue = 0;
    let criticalItemsCount = 0;

    for (const sp of storeProducts) {
      totalInventoryUnits += sp.usable_on_hand;
      totalInventoryValue += (sp.usable_on_hand * sp.unit_cost);
      if (sp.usable_on_hand < (sp.case_pack_size * 2)) {
        criticalItemsCount++;
      }
    }

    const forecastUnits7d = Math.round(
      latestForecast?.summary?.totalForecastUnits ??
      (latestForecast?.forecasts?.reduce((acc: number, f: any) => acc + (f.predicted_mean || 0), 0) || 0)
    );

    res.json({
      success: true,
      stats: {
        dataset: dataset ? {
          id: dataset._id,
          name: dataset.name,
          sourceType: dataset.sourceType,
          isSynthetic: dataset.isSynthetic,
          rowCount: dataset.rowCount,
          dateRange: `${dataset.startDate} to ${dataset.endDate}`,
          defaultTarget: dataset.defaultTarget
        } : null,
        activeLocationsCount: totalStores || 5,
        activeSkusCount: totalProducts || 20,
        activeModel: activeModel ? {
          algorithm: activeModel.algorithm,
          target: activeModel.target,
          testWape: activeModel.metrics?.test?.wape,
          testMae: activeModel.metrics?.test?.mae,
          testRmse: activeModel.metrics?.test?.rmse
        } : null,
        totalInventoryUnits,
        totalInventoryValue: Math.round(totalInventoryValue),
        forecastUnits7d: Math.round(forecastUnits7d),
        criticalItemsCount: latestPlan?.criticalCount || criticalItemsCount,
        recentPlanStatus: latestPlan?.status || 'NO_PLAN',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
