import mongoose, { Schema, Document } from 'mongoose';

export interface IStoreProduct extends Document {
  datasetId: mongoose.Types.ObjectId;
  store_id: string;
  product_id: string;
  category: string;
  region: string;
  review_period_days: number;
  lead_time_days: number;
  target_service_level: number;
  usable_on_hand: number;
  confirmed_on_order: number;
  committed_stock: number;
  case_pack_size: number;
  min_order_qty: number;
  unit_cost: number;
  selling_price: number;
  holding_cost_per_day: number;
  shortage_penalty_per_unit: number;
  shelf_life_days?: number;
  updatedAt: Date;
}

const StoreProductSchema = new Schema<IStoreProduct>({
  datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  store_id: { type: String, required: true },
  product_id: { type: String, required: true },
  category: { type: String, required: true },
  region: { type: String, required: true },
  review_period_days: { type: Number, default: 1 },
  lead_time_days: { type: Number, default: 2 },
  target_service_level: { type: Number, default: 0.95 },
  usable_on_hand: { type: Number, default: 50 },
  confirmed_on_order: { type: Number, default: 0 },
  committed_stock: { type: Number, default: 0 },
  case_pack_size: { type: Number, default: 6 },
  min_order_qty: { type: Number, default: 12 },
  unit_cost: { type: Number, default: 45.0 },
  selling_price: { type: Number, default: 65.0 },
  holding_cost_per_day: { type: Number, default: 0.05 },
  shortage_penalty_per_unit: { type: Number, default: 15.0 },
  shelf_life_days: { type: Number },
  updatedAt: { type: Date, default: Date.now }
});

StoreProductSchema.index({ datasetId: 1, store_id: 1, product_id: 1 }, { unique: true });

export const StoreProduct = mongoose.model<IStoreProduct>('StoreProduct', StoreProductSchema);
