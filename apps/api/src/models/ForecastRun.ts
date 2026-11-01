import mongoose, { Schema, Document } from 'mongoose';
import { ForecastTarget } from '@quickstock/shared';

export interface IForecastRun extends Document {
  forecastRunId: string;
  modelRunId: string;
  datasetId: mongoose.Types.ObjectId;
  target: ForecastTarget;
  horizonDays: number;
  summary: {
    totalForecastUnits: number;
    avgDailyPerStoreProduct: number;
    coldStartCount: number;
    totalSeriesCount: number;
  };
  forecasts: Array<{
    date: string;
    store_id: string;
    product_id: string;
    predicted_mean: number;
    lower_bound: number;
    upper_bound: number;
    is_cold_start?: boolean;
  }>;
  createdAt: Date;
}

const ForecastRunSchema = new Schema<IForecastRun>({
  forecastRunId: { type: String, required: true, unique: true, index: true },
  modelRunId: { type: String, required: true, index: true },
  datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  target: { type: String, enum: Object.values(ForecastTarget), required: true },
  horizonDays: { type: Number, required: true },
  summary: {
    totalForecastUnits: { type: Number, default: 0 },
    avgDailyPerStoreProduct: { type: Number, default: 0 },
    coldStartCount: { type: Number, default: 0 },
    totalSeriesCount: { type: Number, default: 0 }
  },
  forecasts: [{
    date: { type: String, required: true, index: true },
    store_id: { type: String, required: true, index: true },
    product_id: { type: String, required: true, index: true },
    predicted_mean: { type: Number, required: true },
    lower_bound: { type: Number, required: true },
    upper_bound: { type: Number, required: true },
    is_cold_start: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

export const ForecastRun = mongoose.model<IForecastRun>('ForecastRun', ForecastRunSchema);
