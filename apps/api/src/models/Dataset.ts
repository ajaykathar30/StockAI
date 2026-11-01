import mongoose, { Schema, Document } from 'mongoose';
import { ForecastTarget } from '@quickstock/shared';

export interface IDataset extends Document {
  name: string;
  sourceType: 'DEMO' | 'UPLOAD' | 'KAGGLE';
  filePath: string;
  rowCount: number;
  validRowCount: number;
  quarantineRowCount: number;
  quarantineFilePath?: string;
  storeCount: number;
  productCount: number;
  categories: string[];
  startDate: string;
  endDate: string;
  defaultTarget: ForecastTarget;
  isSynthetic: boolean;
  isActive: boolean;
  provenance: {
    datasetSlug?: string;
    filename: string;
    uploadedAt: string;
    checksum?: string;
    notes: string;
  };
  validationReport?: any;
  createdAt: Date;
}

const DatasetSchema = new Schema<IDataset>({
  name: { type: String, required: true },
  sourceType: { type: String, enum: ['DEMO', 'UPLOAD', 'KAGGLE'], default: 'DEMO' },
  filePath: { type: String, required: true },
  rowCount: { type: Number, default: 0 },
  validRowCount: { type: Number, default: 0 },
  quarantineRowCount: { type: Number, default: 0 },
  quarantineFilePath: { type: String },
  storeCount: { type: Number, default: 0 },
  productCount: { type: Number, default: 0 },
  categories: [{ type: String }],
  startDate: { type: String },
  endDate: { type: String },
  defaultTarget: { type: String, enum: Object.values(ForecastTarget), default: ForecastTarget.UNITS_SOLD },
  isSynthetic: { type: Boolean, default: true },
  isActive: { type: Boolean, default: false },
  provenance: {
    datasetSlug: { type: String },
    filename: { type: String, required: true },
    uploadedAt: { type: String, default: () => new Date().toISOString() },
    checksum: { type: String },
    notes: { type: String }
  },
  validationReport: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

export const Dataset = mongoose.model<IDataset>('Dataset', DatasetSchema);
