import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string;
  userId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  action: { type: String, required: true, index: true },
  userId: { type: String },
  details: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
