import { Router, Request, Response } from 'express';
import { StoreProduct } from '../models/StoreProduct';
import { ForecastRun } from '../models/ForecastRun';
import { PurchasePlan } from '../models/PurchasePlan';
import { Dataset } from '../models/Dataset';
import { mlClient } from '../services/mlClient';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST generate replenishment recommendations
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { storeId, category, warehouseCapacityLimit, procurementBudgetLimit } = req.body;

    const activeDataset = await Dataset.findOne({ isActive: true });
    const query: any = {};
    if (activeDataset) {
      const hasDatasetItems = await StoreProduct.exists({ datasetId: activeDataset._id });
      if (hasDatasetItems) query.datasetId = activeDataset._id;
    }

    if (storeId && storeId !== 'ALL') query.store_id = storeId;
    if (category && category !== 'ALL') query.category = category;

    const storeProducts = await StoreProduct.find(query);
    if (!storeProducts.length) {
      return res.status(400).json({ success: false, error: 'No store products found matching filters.' });
    }

    // Get latest forecast run
    let fcQuery: any = {};
    if (activeDataset) {
      const hasDatasetFc = await ForecastRun.exists({ datasetId: activeDataset._id });
      if (hasDatasetFc) fcQuery.datasetId = activeDataset._id;
    }
    const latestForecast = await ForecastRun.findOne(fcQuery).sort({ createdAt: -1 });
    const forecastsBySeries: Record<string, any[]> = {};

    if (latestForecast) {
      for (const fc of latestForecast.forecasts) {
        const key = `${fc.store_id}::${fc.product_id}`;
        if (!forecastsBySeries[key]) forecastsBySeries[key] = [];
        forecastsBySeries[key].push(fc);
      }
    }

    const mlRes = await mlClient.calculateRecommendations({
      params: storeProducts.map(sp => ({
        store_id: sp.store_id,
        product_id: sp.product_id,
        category: sp.category,
        lead_time_days: sp.lead_time_days,
        review_period_days: sp.review_period_days,
        target_service_level: sp.target_service_level,
        usable_on_hand: sp.usable_on_hand,
        confirmed_on_order: sp.confirmed_on_order,
        committed_stock: sp.committed_stock,
        case_pack_size: sp.case_pack_size,
        min_order_qty: sp.min_order_qty,
        unit_cost: sp.unit_cost,
        selling_price: sp.selling_price,
        shelf_life_days: sp.shelf_life_days
      })),
      forecastsBySeries,
      warehouseCapacityLimit: warehouseCapacityLimit ? parseInt(warehouseCapacityLimit, 10) : undefined,
      procurementBudgetLimit: procurementBudgetLimit ? parseFloat(procurementBudgetLimit) : undefined
    });

    res.json({
      success: true,
      recommendations: mlRes.recommendations.items,
      summary: mlRes.recommendations.summary
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET all saved purchase plans
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = await PurchasePlan.find().sort({ createdAt: -1 });
    res.json({ success: true, plans });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET specific plan
router.get('/plans/:id', async (req: Request, res: Response) => {
  try {
    const plan = await PurchasePlan.findOne({ planId: req.params.id });
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Purchase plan not found' });
    }
    res.json({ success: true, plan });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST save draft plan
router.post('/plans', async (req: Request, res: Response) => {
  try {
    const { name, items, notes } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, error: 'Cannot save an empty replenishment plan.' });
    }

    const planId = `plan_${Date.now()}_${uuidv4().substring(0, 6)}`;
    const totalUnits = items.reduce((acc: number, cur: any) => acc + (cur.rounded_order_qty || 0), 0);
    const totalCost = items.reduce((acc: number, cur: any) => acc + (cur.total_order_cost || 0), 0);
    const criticalCount = items.filter((i: any) => i.priority === 'Critical').length;
    const reorderSoonCount = items.filter((i: any) => i.priority === 'Reorder soon').length;

    const plan = await PurchasePlan.create({
      planId,
      name: name || `Replenishment Draft - ${new Date().toLocaleDateString()}`,
      status: 'DRAFT',
      items,
      totalUnits,
      totalCost: Math.round(totalCost * 100) / 100,
      criticalCount,
      reorderSoonCount,
      notes
    });

    res.status(201).json({ success: true, plan });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT approve plan (with explicit confirmation requirement)
router.put('/plans/:id/approve', async (req: Request, res: Response) => {
  try {
    const { confirmed, approvedBy } = req.body;
    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'Explicit user confirmation is mandatory before approving a replenishment plan.'
      });
    }

    const plan = await PurchasePlan.findOne({ planId: req.params.id });
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found.' });
    }

    plan.status = 'APPROVED';
    plan.approvedAt = new Date();
    plan.approvedBy = approvedBy || 'Inventory Analyst';
    plan.updatedAt = new Date();
    await plan.save();

    // Update confirmed_on_order in StoreProduct table as local planning records
    for (const item of plan.items) {
      if (item.rounded_order_qty > 0) {
        await StoreProduct.updateOne(
          { store_id: item.store_id, product_id: item.product_id },
          { $inc: { confirmed_on_order: item.rounded_order_qty } }
        );
      }
    }

    res.json({
      success: true,
      plan,
      notice: 'Plan approved. Local planning records updated (No external purchase order transmitted).'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
