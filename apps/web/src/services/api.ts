import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Overview
export const getOverviewStats = async () => {
  const res = await api.get('/overview/stats');
  return res.data.stats;
};

// Datasets
export const getDatasets = async () => {
  const res = await api.get('/datasets');
  return res.data.datasets;
};

export const getActiveDataset = async () => {
  const res = await api.get('/datasets/active');
  return res.data.dataset;
};

export const triggerDemoSeed = async () => {
  const res = await api.post('/datasets/demo-seed');
  return res.data;
};

export const uploadDatasetFile = async (formData: FormData) => {
  const res = await api.post('/datasets/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const activateDataset = async (id: string) => {
  const res = await api.post(`/datasets/${id}/activate`);
  return res.data;
};

// Store Products
export const getStoreProducts = async (params: { storeId?: string; category?: string; search?: string; page?: number; limit?: number }) => {
  const res = await api.get('/stores-products', { params });
  return res.data;
};

export const updateStoreProduct = async (id: string, data: any) => {
  const res = await api.put(`/stores-products/${id}`, data);
  return res.data;
};

export const bulkUpdateStoreProducts = async (payload: { filter: any; updates: any }) => {
  const res = await api.post('/stores-products/bulk-update', payload);
  return res.data;
};

// Jobs
export const getJobStatus = async (jobId: string) => {
  const res = await api.get(`/jobs/${jobId}`);
  return res.data.job;
};

// Models
export const getModelRuns = async () => {
  const res = await api.get('/models/runs');
  return res.data.runs;
};

export const getActiveModelRun = async () => {
  const res = await api.get('/models/active');
  return res.data.modelRun;
};

export const trainModelJob = async (payload: { algorithm: string; target: string; mode: string }) => {
  const res = await api.post('/models/train', payload);
  return res.data;
};

export const activateModelRun = async (id: string) => {
  const res = await api.post(`/models/${id}/activate`);
  return res.data;
};

// Forecasts
export const getLatestForecasts = async (params: { storeId?: string; productId?: string; horizonDays?: number }) => {
  const res = await api.get('/forecasts/latest', { params });
  return res.data;
};

export const runForecastJob = async (payload: { horizonDays: number; modelRunId?: string }) => {
  const res = await api.post('/forecasts/run', payload);
  return res.data;
};

// Replenishment & Purchase Plans
export const generateRecommendations = async (payload: {
  storeId?: string;
  category?: string;
  warehouseCapacityLimit?: number;
  procurementBudgetLimit?: number;
}) => {
  const res = await api.post('/recommendations/generate', payload);
  return res.data;
};

export const getPurchasePlans = async () => {
  const res = await api.get('/recommendations/plans');
  return res.data.plans;
};

export const saveDraftPlan = async (payload: { name: string; items: any[]; notes?: string }) => {
  const res = await api.post('/recommendations/plans', payload);
  return res.data.plan;
};

export const approvePlan = async (planId: string, payload: { confirmed: boolean; approvedBy?: string }) => {
  const res = await api.put(`/recommendations/plans/${planId}/approve`, payload);
  return res.data;
};

// Simulation
export const getLatestSimulation = async () => {
  const res = await api.get('/simulations/latest');
  return res.data.simulation;
};

export const runSimulationJob = async (payload: any) => {
  const res = await api.post('/simulations/run', payload);
  return res.data;
};

// Reports
export const generatePdfReport = async () => {
  const res = await api.post('/reports/generate-pdf');
  return res.data;
};
