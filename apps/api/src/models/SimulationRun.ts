import mongoose, { Schema, Document } from 'mongoose';

export interface ISimulationRun extends Document {
  simulationId: string;
  datasetId: mongoose.Types.ObjectId;
  modelRunId?: string;
  testStartDate: string;
  testEndDate: string;
  results: Record<string, any>;
  assumptions: Record<string, any>;
  limitationsDisclaimer: string;
  createdAt: Date;
}

const SimulationRunSchema = new Schema<ISimulationRun>({
  simulationId: { type: String, required: true, unique: true, index: true },
  datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  modelRunId: { type: String },
  testStartDate: { type: String, required: true },
  testEndDate: { type: String, required: true },
  results: { type: Schema.Types.Mixed, required: true },
  assumptions: { type: Schema.Types.Mixed, required: true },
  limitationsDisclaimer: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const SimulationRun = mongoose.model<ISimulationRun>('SimulationRun', SimulationRunSchema);
