import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { Dataset } from '../models/Dataset';
import { StoreProduct } from '../models/StoreProduct';
import { uploadCsv } from '../middleware/upload';
import { mlClient } from '../services/mlClient';
import { jobQueue } from '../services/jobQueue';
import { env } from '../config/env';
import { ForecastTarget } from '@quickstock/shared';

const router = Router();

// Helper to seed store-product catalog from validated CSV
async function seedCatalogFromCsv(datasetId: any, csvPath: string) {
  let actualPath = csvPath;
  if (!fs.existsSync(actualPath)) {
    const candidates = [
      path.resolve(process.cwd(), csvPath),
      path.resolve(process.cwd(), '../../', csvPath),
      path.resolve(env.DATA_DIR, '..', csvPath),
      path.resolve(env.DATA_DIR, csvPath.startsWith('data/') ? csvPath.replace(/^data\//, '') : csvPath),
      path.resolve(env.DATA_DIR, 'processed', path.basename(csvPath)),
      path.resolve(env.DATA_DIR, 'demo', path.basename(csvPath))
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        actualPath = c;
        break;
      }
    }
  }

  const fileStream = fs.createReadStream(actualPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers: string[] = [];
  const distinctKeys = new Map<string, any>();

  for await (const line of rl) {
    if (!headers.length) {
      headers = line.split(',').map(h => h.trim());
      continue;
    }
    const cols = line.split(',');
    if (cols.length < 3) continue;

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i]?.trim();
    });

    const storeId = row['store_id'];
    const productId = row['product_id'];
    if (!storeId || !productId) continue;

    const key = `${storeId}::${productId}`;
    if (!distinctKeys.has(key)) {
      const cat = row['category'] || 'General';
      const reg = row['region'] || 'Default';
      const price = parseFloat(row['price']) || 60.0;
      const inv = parseInt(row['inventory_level'], 10) || 50;

      // Assign realistic shelf lives for perishable categories
      let shelfLife: number | undefined = undefined;
      if (cat === 'Dairy') shelfLife = 4;
      else if (cat === 'Bakery') shelfLife = 4;
      else if (cat === 'Produce') shelfLife = 5;

      distinctKeys.set(key, {
        datasetId,
        store_id: storeId,
        product_id: productId,
        category: cat,
        region: reg,
        usable_on_hand: inv,
        confirmed_on_order: 0,
        committed_stock: 0,
        case_pack_size: 6,
        min_order_qty: 12,
        unit_cost: Math.round(price * 0.7),
        selling_price: price,
        holding_cost_per_day: 0.05,
        shortage_penalty_per_unit: 15.0,
        shelf_life_days: shelfLife
      });
    }
  }

  // Clear existing items for this dataset and bulk insert
  await StoreProduct.deleteMany({ datasetId });
  const items = Array.from(distinctKeys.values());
  if (items.length > 0) {
    await StoreProduct.insertMany(items);
  }
}

// GET all datasets
router.get('/', async (req: Request, res: Response) => {
  try {
    const datasets = await Dataset.find().sort({ createdAt: -1 });
    res.json({ success: true, datasets });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET active dataset
router.get('/active', async (req: Request, res: Response) => {
  try {
    let dataset = await Dataset.findOne({ isActive: true });
    if (!dataset) {
      dataset = await Dataset.findOne().sort({ createdAt: -1 });
    }
    res.json({ success: true, dataset });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST trigger synthetic demo dataset generation
router.post('/demo-seed', async (req: Request, res: Response) => {
  try {
    const job = await jobQueue.enqueue('IMPORT', async (jobDoc, updateProgress) => {
      await updateProgress(15, 'Generating synthetic daily quick-commerce demo data (36,500 rows)...');
      const genRes = await mlClient.generateDemoData(365, 42);

      await updateProgress(50, 'Validating dataset schema and checking for anomalies...');
      const valRes = await mlClient.validateData(genRes.filePath);
      const report = valRes.report;

      await updateProgress(80, 'Populating catalog and inventory parameters...');
      // Deactivate other datasets
      await Dataset.updateMany({}, { isActive: false });

      const dataset = await Dataset.create({
        name: 'QuickStock Synthetic Demo Dataset (5 Stores x 20 Products x 365 Days)',
        sourceType: 'DEMO',
        filePath: report.validatedCleanPath || genRes.filePath,
        rowCount: report.totalRows,
        validRowCount: report.validRows,
        quarantineRowCount: report.quarantinedRows,
        quarantineFilePath: report.quarantineFilePath,
        storeCount: report.storeIds.length,
        productCount: report.productIds.length,
        categories: report.categories,
        startDate: report.dateRange.start,
        endDate: report.dateRange.end,
        defaultTarget: ForecastTarget.UNITS_SOLD,
        isSynthetic: true,
        isActive: true,
        provenance: {
          filename: 'demo_sales_data.csv',
          notes: 'Synthetic quick-commerce dark store benchmark generated with fixed seed 42. Observed sales reflects realistic stockout censoring.'
        },
        validationReport: report
      });

      await seedCatalogFromCsv(dataset._id, dataset.filePath);

      await updateProgress(100, 'Demo dataset initialized successfully.');
      return { datasetId: dataset._id, name: dataset.name };
    });

    res.json({ success: true, jobId: job.jobId, message: 'Demo data generation job queued.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST upload user CSV
router.post('/upload', uploadCsv.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;

  try {
    const job = await jobQueue.enqueue('IMPORT', async (jobDoc, updateProgress) => {
      await updateProgress(20, 'Parsing CSV and normalizing to canonical schema...');
      const valRes = await mlClient.validateData(filePath);
      const report = valRes.report;

      await updateProgress(70, 'Creating dataset provenance record...');
      await Dataset.updateMany({}, { isActive: false });

      const dataset = await Dataset.create({
        name: originalName.replace(/\.csv$/i, ''),
        sourceType: 'UPLOAD',
        filePath: report.validatedCleanPath || filePath,
        rowCount: report.totalRows,
        validRowCount: report.validRows,
        quarantineRowCount: report.quarantinedRows,
        quarantineFilePath: report.quarantineFilePath,
        storeCount: report.storeIds.length,
        productCount: report.productIds.length,
        categories: report.categories,
        startDate: report.dateRange.start,
        endDate: report.dateRange.end,
        defaultTarget: ForecastTarget.UNITS_SOLD,
        isSynthetic: false,
        isActive: true,
        provenance: {
          filename: originalName,
          notes: 'User-uploaded custom dataset parsed and validated against QuickStock AI canonical schema.'
        },
        validationReport: report
      });

      await updateProgress(85, 'Extracting store-product inventory master catalog...');
      await seedCatalogFromCsv(dataset._id, dataset.filePath);

      await updateProgress(100, 'Import completed.');
      return { datasetId: dataset._id, report };
    });

    res.json({ success: true, jobId: job.jobId, message: 'CSV upload and validation job queued.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST activate dataset
router.post('/:id/activate', async (req: Request, res: Response) => {
  try {
    await Dataset.updateMany({}, { isActive: false });
    const dataset = await Dataset.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
    if (!dataset) {
      return res.status(404).json({ success: false, error: 'Dataset not found.' });
    }
    res.json({ success: true, dataset });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
