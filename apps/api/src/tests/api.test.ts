import assert from 'assert';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Dataset } from '../models/Dataset';
import { StoreProduct } from '../models/StoreProduct';
import { PurchasePlan } from '../models/PurchasePlan';
import { sanitizeCsvCell, exportReplenishmentToCsv } from '../services/csvExporter';

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  await connectDB();

  // Test 1: User Registration & Password Hashing
  console.log('Test 1: Testing User Model & Password Hashing...');
  const testEmail = `test_${Date.now()}@quickstock.local`;
  const rawPassword = 'secretPassword123';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const testUser = await User.create({
    email: testEmail,
    passwordHash,
    fullName: 'Test Analyst',
    role: 'INVENTORY_MANAGER'
  });

  assert.strictEqual(testUser.email, testEmail);
  const isValidPass = await bcrypt.compare(rawPassword, testUser.passwordHash);
  assert.strictEqual(isValidPass, true, 'Bcrypt verification failed');
  console.log('✔ Test 1 Passed: User creation & password hashing verified.');

  // Test 2: Dataset Persistence
  console.log('Test 2: Testing Dataset Persistence...');
  const testDataset = await Dataset.create({
    name: 'Unit Test Dataset',
    sourceType: 'DEMO',
    filePath: 'data/demo/demo_sales_data.csv',
    rowCount: 36500,
    validRowCount: 36500,
    quarantineRowCount: 0,
    storeCount: 5,
    productCount: 20,
    categories: ['Dairy', 'Snacks'],
    startDate: '2025-11-01',
    endDate: '2026-10-31',
    isSynthetic: true,
    isActive: true,
    provenance: {
      filename: 'demo_sales_data.csv',
      notes: 'Test dataset'
    }
  });

  const fetchedDataset = await Dataset.findById(testDataset._id);
  assert.ok(fetchedDataset);
  assert.strictEqual(fetchedDataset.isSynthetic, true);
  console.log('✔ Test 2 Passed: Dataset saved and retrieved from MongoDB.');

  // Test 3: StoreProduct Compound Index & Inventory Parameters
  console.log('Test 3: Testing StoreProduct Catalog...');
  const testSp = await StoreProduct.create({
    datasetId: testDataset._id,
    store_id: 'DS_TEST_01',
    product_id: 'SKU_TEST_01',
    category: 'Dairy',
    region: 'South',
    usable_on_hand: 40,
    case_pack_size: 6,
    min_order_qty: 12,
    unit_cost: 30.0,
    selling_price: 45.0
  });

  assert.strictEqual(testSp.usable_on_hand, 40);
  assert.strictEqual(testSp.case_pack_size, 6);
  console.log('✔ Test 3 Passed: StoreProduct saved with inventory parameters.');

  // Test 4: Purchase Plan Draft & Approval Persistence
  console.log('Test 4: Testing Purchase Plan Draft & Approval Persistence...');
  const plan = await PurchasePlan.create({
    planId: `test_plan_${Date.now()}`,
    name: 'Draft Replenishment Cycle 1',
    status: 'DRAFT',
    items: [{
      id: 'rec_1',
      store_id: 'DS_TEST_01',
      product_id: 'SKU_TEST_01',
      category: 'Dairy',
      priority: 'Critical',
      protection_period_days: 3,
      protection_period_forecast: 60,
      safety_stock: 15,
      target_stock: 75,
      inventory_position: 40,
      raw_suggested_order: 35,
      rounded_order_qty: 36,
      unit_cost: 30.0,
      total_order_cost: 1080.0,
      explanation: 'Protection period forecast: 60; Safety stock: 15; Position: 40; Suggested order: 36.'
    }],
    totalUnits: 36,
    totalCost: 1080.0,
    criticalCount: 1,
    reorderSoonCount: 0
  });

  assert.strictEqual(plan.status, 'DRAFT');

  // Simulate user approving plan with explicit confirmation
  plan.status = 'APPROVED';
  plan.approvedAt = new Date();
  plan.approvedBy = 'Test Analyst';
  await plan.save();

  const refreshedPlan = await PurchasePlan.findOne({ planId: plan.planId });
  assert.strictEqual(refreshedPlan?.status, 'APPROVED');
  assert.ok(refreshedPlan?.approvedAt);
  console.log('✔ Test 4 Passed: Purchase plan draft and approval survive persistence.');

  // Test 5: CSV Formula Injection Escaping
  console.log('Test 5: Testing CSV Formula Injection Escaping (CWE-1236)...');
  const maliciousCell1 = '=SUM(A1:A10)';
  const maliciousCell2 = '+cmd|/c calc!A0';
  const maliciousCell3 = '-20';
  const maliciousCell4 = '@evil';
  const benignCell = 'Fresh Milk 1L';

  assert.strictEqual(sanitizeCsvCell(maliciousCell1), "'=SUM(A1:A10)");
  assert.strictEqual(sanitizeCsvCell(maliciousCell2), "'+cmd|/c calc!A0");
  assert.strictEqual(sanitizeCsvCell(maliciousCell3), "'-20");
  assert.strictEqual(sanitizeCsvCell(maliciousCell4), "'@evil");
  assert.strictEqual(sanitizeCsvCell(benignCell), 'Fresh Milk 1L');
  console.log('✔ Test 5 Passed: Spreadsheet formula prefixes safely escaped.');

  // Clean up test records
  await User.deleteOne({ _id: testUser._id });
  await StoreProduct.deleteOne({ _id: testSp._id });
  await PurchasePlan.deleteOne({ _id: plan._id });
  await Dataset.deleteOne({ _id: testDataset._id });

  await mongoose.disconnect();
  console.log('--- ALL API INTEGRATION TESTS PASSED (5/5) ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('API Test Failure:', err);
  process.exit(1);
});
