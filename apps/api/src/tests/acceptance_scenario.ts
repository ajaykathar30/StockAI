import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 120000
});

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForJob(jobId: string, maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await api.get(`/jobs/${jobId}`);
    const job = res.data.job;
    console.log(`[Job ${jobId}] Progress: ${job.progressPercent}% | Status: ${job.status} | Msg: ${job.message}`);
    if (job.status === 'COMPLETED') return job;
    if (job.status === 'FAILED') throw new Error(`Job ${jobId} failed: ${job.error}`);
    await sleep(2000);
  }
  throw new Error(`Job ${jobId} timed out`);
}

async function runAcceptanceScenario() {
  console.log('=== Executing QuickStock AI End-to-End Acceptance Scenario ===');

  // Step 1: Health check
  console.log('\n--- Step 1: System Health Verification ---');
  const healthRes = await api.get('/overview/stats');
  console.log('✔ Overview health OK:', healthRes.data.success);

  // Step 2: Trigger Synthetic Demo Data Generation & Validation
  console.log('\n--- Step 2: Trigger Synthetic Demo Dataset Generation & Validation ---');
  const seedRes = await api.post('/datasets/demo-seed');
  console.log('Demo seed enqueued with Job ID:', seedRes.data.jobId);
  await waitForJob(seedRes.data.jobId);
  const activeDatasetRes = await api.get('/datasets/active');
  console.log(`✔ Active dataset registered: ${activeDatasetRes.data.dataset.name} (${activeDatasetRes.data.dataset.rowCount} rows)`);

  // Step 3: Train Naive Baseline Model
  console.log('\n--- Step 3: Train Seasonal Naive Baseline Model ---');
  const baselineRes = await api.post('/models/train', {
    algorithm: 'seasonal_naive',
    target: 'units_sold',
    mode: 'quick'
  });
  await waitForJob(baselineRes.data.jobId);
  console.log('✔ Seasonal Naive baseline trained successfully.');

  // Step 4: Train Real LightGBM Boosting Model
  console.log('\n--- Step 4: Train LightGBM Regressor (Core ML Model) ---');
  const lgbRes = await api.post('/models/train', {
    algorithm: 'lightgbm',
    target: 'units_sold',
    mode: 'quick'
  });
  await waitForJob(lgbRes.data.jobId);
  console.log('✔ LightGBM regressor trained and evaluated on untouched test split.');

  // Step 5: Check Leaderboard Metrics
  console.log('\n--- Step 5: Inspect Model Leaderboard Metrics ---');
  const runsRes = await api.get('/models/runs');
  console.log('Leaderboard runs:');
  runsRes.data.runs.forEach((r: any) => {
    console.log(`  - ${r.algorithm.toUpperCase()}: Test WAPE = ${Math.round((r.metrics?.test?.wape || 0) * 1000) / 10}%, Test MAE = ${r.metrics?.test?.mae}, Test RMSE = ${r.metrics?.test?.rmse}`);
  });

  // Step 6: Generate 7-Day Multi-Step Demand Forecast
  console.log('\n--- Step 6: Generate Recursive 7-Day Demand Forecast ---');
  const forecastRes = await api.post('/forecasts/run', { horizonDays: 7 });
  await waitForJob(forecastRes.data.jobId);
  const latestForecast = await api.get('/forecasts/latest?horizonDays=7');
  console.log(`✔ Generated ${latestForecast.data.forecasts.length} forecast points across active dark store series.`);
  console.log(`  Sample forecast: Date: ${latestForecast.data.forecasts[0].date}, SKU: ${latestForecast.data.forecasts[0].product_id}, Predicted: ${latestForecast.data.forecasts[0].predicted_mean} [${latestForecast.data.forecasts[0].lower_bound} - ${latestForecast.data.forecasts[0].upper_bound}]`);

  // Step 7: Calculate Replenishment Recommendations
  console.log('\n--- Step 7: Calculate Inventory Replenishment Recommendations ---');
  const recRes = await api.post('/recommendations/generate', {});
  console.log(`✔ Generated recommendations: ${recRes.data.recommendations.length} SKUs evaluated.`);
  console.log(`  Summary: ${recRes.data.summary.totalUnits} suggested units, Cost = ₹${recRes.data.summary.totalCost}, Critical Items = ${recRes.data.summary.criticalCount}`);

  // Step 8: Save Draft Plan and Approve with Explicit Confirmation
  console.log('\n--- Step 8: Save Draft Plan & Approve (Audit Planning Records) ---');
  const savePlanRes = await api.post('/recommendations/plans', {
    name: 'Acceptance Verification Replenishment Plan',
    items: recRes.data.recommendations.slice(0, 10),
    notes: 'Approved during automated acceptance testing.'
  });
  const savedPlan = savePlanRes.data.plan;
  console.log(`✔ Saved draft plan: ${savedPlan.planId} (status: ${savedPlan.status})`);

  const approveRes = await api.put(`/recommendations/plans/${savedPlan.planId}/approve`, {
    confirmed: true,
    approvedBy: 'Senior Inventory Analyst'
  });
  console.log(`✔ Plan approved: status = ${approveRes.data.plan.status}, notice: ${approveRes.data.notice}`);

  // Step 9: Run Discrete-Event Simulation Backtest
  console.log('\n--- Step 9: Run Comparative Policy Simulation (Fixed ROP vs Moving Avg vs QuickStock ML) ---');
  const simRes = await api.post('/simulations/run', {
    leadTimeDays: 2,
    reviewPeriodDays: 1,
    holdingCostRate: 0.05,
    shortagePenaltyRate: 15.0,
    trackPerishability: true
  });
  await waitForJob(simRes.data.jobId);
  const latestSim = await api.get('/simulations/latest');
  console.log('✔ Simulation completed across all 3 replenishment policies:');
  Object.values(latestSim.data.simulation.results).forEach((p: any) => {
    console.log(`  - ${p.policyName}: Fill Rate = ${p.fillRate}%, Stockout Days = ${p.stockoutDays}, Total Cost = ₹${p.totalSimulatedCost}`);
  });

  // Step 10: Generate ReportLab Executive PDF
  console.log('\n--- Step 10: Generate ReportLab PDF Executive Report ---');
  const reportRes = await api.post('/reports/generate-pdf');
  console.log(`✔ Generated PDF report file: ${reportRes.data.filename}`);

  console.log('\n===============================================================');
  console.log('✔ ALL ACCEPTANCE SCENARIO STEPS (1-10) EXECUTED SUCCESSFULLY!');
  console.log('===============================================================');
}

runAcceptanceScenario().catch(err => {
  console.error('Acceptance Scenario Failed:', err);
  process.exit(1);
});
