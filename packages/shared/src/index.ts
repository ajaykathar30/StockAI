import { z } from 'zod';

// ==========================================
// 1. DATASET & CANONICAL SCHEMA DEFINITIONS
// ==========================================

export const CanonicalRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  store_id: z.string().min(1, 'Store ID is required'),
  product_id: z.string().min(1, 'Product ID is required'),
  category: z.string().min(1, 'Category is required'),
  region: z.string().min(1, 'Region is required'),
  inventory_level: z.number().nonnegative('Inventory level must be >= 0'),
  units_sold: z.number().nonnegative('Units sold must be >= 0'),
  units_ordered: z.number().nonnegative('Units ordered must be >= 0'),
  price: z.number().positive('Price must be > 0'),
  discount: z.number().min(0, 'Discount must be >= 0'),
  weather_condition: z.string().default('Sunny'),
  promotion: z.number().int().min(0).max(1).default(0),
  competitor_pricing: z.number().positive().optional(),
  seasonality: z.number().optional().default(1.0),
  epidemic: z.number().int().min(0).max(1).default(0),
  estimated_demand: z.number().nonnegative().optional()
});

export type CanonicalRow = z.infer<typeof CanonicalRowSchema>;

export enum ForecastTarget {
  UNITS_SOLD = 'units_sold',
  ESTIMATED_DEMAND = 'estimated_demand'
}

export const ForecastTargetLabels: Record<ForecastTarget, string> = {
  [ForecastTarget.UNITS_SOLD]: 'Observed-sales forecast',
  [ForecastTarget.ESTIMATED_DEMAND]: 'Synthetic estimated-demand forecast'
};

export interface DatasetSummary {
  id: string;
  name: string;
  sourceType: 'DEMO' | 'UPLOAD' | 'KAGGLE';
  rowCount: number;
  validRowCount: number;
  quarantineRowCount: number;
  storeCount: number;
  productCount: number;
  categories: string[];
  startDate: string;
  endDate: string;
  defaultTarget: ForecastTarget;
  isSynthetic: boolean;
  provenance: {
    datasetSlug?: string;
    filename: string;
    uploadedAt: string;
    checksum?: string;
    notes: string;
  };
}

export interface ValidationReport {
  totalRows: number;
  validRows: number;
  quarantinedRows: number;
  warnings: string[];
  issuesSummary: Record<string, number>;
  quarantineFilePath?: string;
  dateRange: { start: string; end: string };
  storeIds: string[];
  productIds: string[];
  categories: string[];
}

// ==========================================
// 2. MACHINE LEARNING & FORECASTING CONTRACTS
// ==========================================

export enum ModelAlgorithm {
  PREVIOUS_DAY_NAIVE = 'previous_day_naive',
  SEASONAL_NAIVE = 'seasonal_naive',
  TRAILING_7D_MEAN = 'trailing_7d_mean',
  RANDOM_FOREST = 'random_forest',
  XGBOOST = 'xgboost',
  LIGHTGBM = 'lightgbm'
}

export const ModelAlgorithmLabels: Record<ModelAlgorithm, string> = {
  [ModelAlgorithm.PREVIOUS_DAY_NAIVE]: 'Baseline: Previous-Day Naive',
  [ModelAlgorithm.SEASONAL_NAIVE]: 'Baseline: Seasonal Naive (7-Day)',
  [ModelAlgorithm.TRAILING_7D_MEAN]: 'Baseline: Trailing 7-Day Mean',
  [ModelAlgorithm.RANDOM_FOREST]: 'Random Forest Regressor',
  [ModelAlgorithm.XGBOOST]: 'XGBoost Regressor',
  [ModelAlgorithm.LIGHTGBM]: 'LightGBM Regressor'
};

export type ForecastHorizon = 1 | 7 | 14;

export interface ModelMetrics {
  mae: number;
  rmse: number;
  wape: number; // Handling zero denominator
  smape: number; // Symmetric MAPE with zero safeguard
  intervalCoverage?: number; // % of test actuals falling within [lower, upper]
}

export interface ModelRun {
  id: string;
  datasetId: string;
  target: ForecastTarget;
  algorithm: ModelAlgorithm;
  hyperparameters: Record<string, any>;
  trainSplitDates: { trainEnd: string; valEnd: string; testEnd: string };
  metrics: {
    validation: ModelMetrics;
    test: ModelMetrics;
    byCategory?: Record<string, ModelMetrics>;
  };
  featureImportance?: Array<{ feature: string; importance: number; type: 'native' | 'permutation' }>;
  artifactPath?: string;
  createdAt: string;
  isActive: boolean;
  mode: 'quick' | 'full';
}

export interface ForecastPoint {
  date: string;
  store_id: string;
  product_id: string;
  predicted_mean: number;
  lower_bound: number; // e.g. 10th percentile
  upper_bound: number; // e.g. 90th percentile
  is_cold_start?: boolean;
}

export interface ForecastRun {
  id: string;
  modelRunId: string;
  datasetId: string;
  target: ForecastTarget;
  horizonDays: ForecastHorizon;
  forecasts: ForecastPoint[];
  createdAt: string;
  summary: {
    totalForecastUnits: number;
    avgDailyPerStoreProduct: number;
    coldStartCount: number;
  };
}

// ==========================================
// 3. INVENTORY & REPLENISHMENT ENGINE
// ==========================================

export enum RecommendationPriority {
  CRITICAL = 'Critical',
  REORDER_SOON = 'Reorder soon',
  HEALTHY = 'Healthy',
  EXCESS = 'Excess inventory'
}

export interface StoreProductParams {
  store_id: string;
  product_id: string;
  category: string;
  review_period_days: number; // R
  lead_time_days: number; // L
  target_service_level: number; // e.g., 0.95 (95%)
  usable_on_hand: number;
  confirmed_on_order: number;
  committed_stock: number;
  case_pack_size: number;
  min_order_qty: number; // MOQ
  unit_cost: number;
  selling_price: number;
  holding_cost_per_day: number;
  shortage_penalty_per_unit: number;
  shelf_life_days?: number; // Optional perishability
}

export interface RecommendationItem {
  id: string;
  store_id: string;
  product_id: string;
  category: string;
  priority: RecommendationPriority;
  protection_period_days: number; // L + R
  protection_period_forecast: number;
  safety_stock: number;
  target_stock: number; // forecast + safety stock
  inventory_position: number; // on_hand + on_order - committed
  raw_suggested_order: number; // max(0, target_stock - inventory_position)
  rounded_order_qty: number; // pack rounding and MOQ applied
  unit_cost: number;
  total_order_cost: number;
  service_level_achieved: number;
  expiry_risk_units: number;
  is_budget_constrained: boolean;
  is_capacity_constrained: boolean;
  explanation: string;
  audit_formula: {
    formula: string;
    values: Record<string, number | string>;
  };
}

export interface PurchasePlan {
  id: string;
  name: string;
  status: 'DRAFT' | 'APPROVED';
  items: RecommendationItem[];
  totalUnits: number;
  totalCost: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  notes?: string;
}

// ==========================================
// 4. INVENTORY SIMULATION & BACKTESTING
// ==========================================

export enum SimulationPolicyType {
  FIXED_ROP = 'fixed_reorder_point',
  MOVING_AVG_ORDER_UP_TO = 'moving_average_order_up_to',
  ML_DRIVEN = 'ml_driven_replenishment'
}

export const SimulationPolicyLabels: Record<SimulationPolicyType, string> = {
  [SimulationPolicyType.FIXED_ROP]: 'Fixed Reorder-Point Policy (s, Q)',
  [SimulationPolicyType.MOVING_AVG_ORDER_UP_TO]: 'Moving-Average Order-Up-To Policy',
  [SimulationPolicyType.ML_DRIVEN]: 'QuickStock ML-Driven Replenishment'
};

export interface PolicySimulationResult {
  policyType: SimulationPolicyType;
  policyName: string;
  unitsRequested: number;
  unitsFulfilled: number;
  fillRate: number; // unitsFulfilled / unitsRequested
  stockoutDays: number;
  unmetDemandUnits: number;
  averageInventory: number;
  totalHoldingCost: number;
  totalShortageCost: number;
  totalOrderingCost: number;
  totalWasteCost: number;
  expiredUnits: number;
  totalSimulatedCost: number;
  dailyLedger: Array<{
    date: string;
    demand: number;
    fulfilled: number;
    lostSales: number;
    onHandEnd: number;
    ordersPlaced: number;
    ordersReceived: number;
    expiredUnits: number;
    dailyCost: number;
  }>;
}

export interface SimulationRun {
  id: string;
  datasetId: string;
  modelRunId?: string;
  testStartDate: string;
  testEndDate: string;
  results: Record<SimulationPolicyType, PolicySimulationResult>;
  assumptions: {
    leadTimeDays: number;
    reviewPeriodDays: number;
    holdingCostDailyRate: number;
    shortagePenaltyPerUnit: number;
    orderPlacementCost: number;
    trackPerishability: boolean;
    defaultShelfLifeDays?: number;
  };
  limitationsDisclaimer: string;
  createdAt: string;
}

// ==========================================
// 5. JOBS & ASYNC OPERATIONS
// ==========================================

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface JobState {
  jobId: string;
  type: 'IMPORT' | 'TRAINING' | 'FORECAST' | 'SIMULATION' | 'REPORT';
  status: JobStatus;
  progressPercent: number;
  message: string;
  error?: string;
  resultPayload?: any;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 6. USER & AUTH
// ==========================================

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'DEMO_ANALYST' | 'INVENTORY_MANAGER' | 'ADMIN';
  organization: string;
}
