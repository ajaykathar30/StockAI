import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'DEMO_ANALYST' | 'INVENTORY_MANAGER' | 'ADMIN';
  organization: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true, trim: true },
  role: { type: String, enum: ['DEMO_ANALYST', 'INVENTORY_MANAGER', 'ADMIN'], default: 'INVENTORY_MANAGER' },
  organization: { type: String, default: 'Academic Quick-Commerce Lab' },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', UserSchema);
