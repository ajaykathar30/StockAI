import bcrypt from 'bcryptjs';
import { connectDB } from './config/db';
import { User } from './models/User';
import { Dataset } from './models/Dataset';
import { StoreProduct } from './models/StoreProduct';
import { mlClient } from './services/mlClient';
import { ForecastTarget } from '@quickstock/shared';

async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  // 1. Create or update Demo Analyst user
  const email = 'analyst@quickstock.local';
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash('quickstock123', 10);
    user = await User.create({
      email,
      passwordHash,
      fullName: 'Quick-Commerce Inventory Analyst',
      role: 'INVENTORY_MANAGER',
      organization: 'IIIT Academic Prototype'
    });
    console.log('[Seed] Created default user: analyst@quickstock.local (password: quickstock123)');
  } else {
    console.log('[Seed] Default user exists: analyst@quickstock.local');
  }

  // 2. Check if active dataset exists
  let dataset = await Dataset.findOne({ isActive: true });
  if (!dataset) {
    console.log('[Seed] Generating initial demo dataset via ML service...');
    try {
      const genRes = await mlClient.generateDemoData(365, 42);
      const valRes = await mlClient.validateData(genRes.filePath);
      const report = valRes.report;

      dataset = await Dataset.create({
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
      console.log('[Seed] Demo dataset registered in MongoDB.');
    } catch (err) {
      console.warn('[Seed] Note: ML service not yet running during initial seed, skipping dataset auto-gen (will be triggered on demand).');
    }
  } else {
    console.log(`[Seed] Active dataset already exists: ${dataset.name}`);
  }

  console.log('[Seed] Seeding completed.');
  process.exit(0);
}

seed().catch(err => {
  console.error('[Seed] Error during seeding:', err);
  process.exit(1);
});
