import mongoose, { Schema, Document } from 'mongoose';
import { JobStatus } from '@quickstock/shared';

export interface IJob extends Document {
  jobId: string;
  type: 'IMPORT' | 'TRAINING' | 'FORECAST' | 'SIMULATION' | 'REPORT';
  status: JobStatus;
  progressPercent: number;
  message: string;
  error?: string;
  resultPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>({
  jobId: { type: String, required: true, unique: true, index: true },
  type: { type: String, enum: ['IMPORT', 'TRAINING', 'FORECAST', 'SIMULATION', 'REPORT'], required: true },
  status: { type: String, enum: Object.values(JobStatus), default: JobStatus.QUEUED },
  progressPercent: { type: Number, default: 0 },
  message: { type: String, default: 'Queued' },
  error: { type: String },
  resultPayload: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Job = mongoose.model<IJob>('Job', JobSchema);
