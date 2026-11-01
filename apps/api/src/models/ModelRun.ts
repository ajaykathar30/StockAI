import mongoose, { Schema, Document } from 'mongoose';
import { ModelAlgorithm, ForecastTarget } from '@quickstock/shared';

export interface IModelRun extends Document {
  modelId: string;
  datasetId: mongoose.Types.ObjectId;
  target: ForecastTarget;
  algorithm: ModelAlgorithm;
  hyperparameters: Record<string, any>;
  trainSplitDates: { trainEnd: string; valEnd: string; testEnd: string };
  metrics: {
    validation: { mae: number; rmse: number; wape: number; smape: number };
    test: { mae: number; rmse: number; wape: number; smape: number; intervalCoverage?: number };
    byCategory?: Record<string, any>;
  };
  featureImportance: Array<{ feature: string; importance: number; type: 'native' | 'permutation' }>;
  artifactPath: string;
  isActive: boolean;
  mode: 'quick' | 'full';
  createdAt: Date;
}

const ModelRunSchema = new Schema<IModelRun>({
  modelId: { type: String, required: true, unique: true, index: true },
  datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  target: { type: String, enum: Object.values(ForecastTarget), required: true },
  algorithm: { type: String, enum: Object.values(ModelAlgorithm), required: true },
  hyperparameters: { type: Schema.Types.Mixed, default: {} },
  trainSplitDates: {
    trainEnd: { type: String },
    valEnd: { type: String },
    testEnd: { type: String }
  },
  metrics: { type: Schema.Types.Mixed, required: true },
  featureImportance: [{ feature: String, importance: Number, type: { type: String } }],
  artifactPath: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  mode: { type: String, enum: ['quick', 'full'], default: 'quick' },
  createdAt: { type: Date, default: Date.now }
});

export const ModelRun = mongoose.model<IModelRun>('ModelRun', ModelRunSchema);
