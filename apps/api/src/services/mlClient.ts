import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';

class MLServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.ML_SERVICE_URL,
      timeout: 120000, // 2 minutes for training / simulations
      headers: {
        'Content-Type': 'application/json',
        'X-ML-Service-Token': env.ML_SERVICE_TOKEN
      }
    });
  }

  async checkHealth() {
    const res = await this.client.get('/health');
    return res.data;
  }

  async generateDemoData(days = 365, seed = 42) {
    const res = await this.client.post('/api/generate-demo-data', { days, seed });
    return res.data;
  }

  async validateData(filePath: string) {
    const res = await this.client.post('/api/validate-data', { filePath });
    return res.data;
  }

  async trainModel(payload: {
    datasetPath: string;
    targetCol?: string;
    algorithm?: string;
    mode?: string;
    randomSeed?: number;
  }) {
    const res = await this.client.post('/api/train', {
      datasetPath: payload.datasetPath,
      targetCol: payload.targetCol || 'units_sold',
      algorithm: payload.algorithm || 'lightgbm',
      mode: payload.mode || 'quick',
      randomSeed: payload.randomSeed || 42
    });
    return res.data;
  }

  async generateForecast(payload: {
    modelArtifactPath: string;
    datasetPath: string;
    horizonDays?: number;
    storeIds?: string[];
    productIds?: string[];
  }) {
    const res = await this.client.post('/api/forecast', {
      modelArtifactPath: payload.modelArtifactPath,
      datasetPath: payload.datasetPath,
      horizonDays: payload.horizonDays || 7,
      storeIds: payload.storeIds,
      productIds: payload.productIds
    });
    return res.data;
  }

  async calculateRecommendations(payload: {
    params: any[];
    forecastsBySeries: Record<string, any[]>;
    warehouseCapacityLimit?: number;
    procurementBudgetLimit?: number;
  }) {
    const res = await this.client.post('/api/recommend', payload);
    return res.data;
  }

  async simulate(payload: {
    datasetPath: string;
    forecastArtifactPath?: string;
    targetCol?: string;
    leadTimeDays?: number;
    reviewPeriodDays?: number;
    holdingCostRate?: number;
    shortagePenaltyRate?: number;
    trackPerishability?: boolean;
    defaultShelfLifeDays?: number;
  }) {
    const res = await this.client.post('/api/simulate', payload);
    return res.data;
  }

  async generateReport(summaryData: Record<string, any>) {
    const res = await this.client.post('/api/generate-report', { summaryData });
    return res.data;
  }
}

export const mlClient = new MLServiceClient();
