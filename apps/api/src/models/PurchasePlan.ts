import mongoose, { Schema, Document } from 'mongoose';
import { RecommendationItem } from '@quickstock/shared';

export interface IPurchasePlan extends Document {
  planId: string;
  name: string;
  status: 'DRAFT' | 'APPROVED';
  items: RecommendationItem[];
  totalUnits: number;
  totalCost: number;
  criticalCount: number;
  reorderSoonCount: number;
  approvedAt?: Date;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchasePlanSchema = new Schema({
  planId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  status: { type: String, enum: ['DRAFT', 'APPROVED'], default: 'DRAFT' },
  items: { type: [Schema.Types.Mixed], default: [] },
  totalUnits: { type: Number, default: 0 },
  totalCost: { type: Number, default: 0 },
  criticalCount: { type: Number, default: 0 },
  reorderSoonCount: { type: Number, default: 0 },
  approvedAt: { type: Date },
  approvedBy: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const PurchasePlan = mongoose.model<IPurchasePlan>('PurchasePlan', PurchasePlanSchema);
