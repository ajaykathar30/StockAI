import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB connected successfully to ${env.MONGODB_URI} (DB: ${env.MONGODB_DB_NAME})`);
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error);
    console.warn('[Database] Running without persistent Atlas connection. Please verify local mongod or Atlas credentials in .env.');
    throw error;
  }
}
