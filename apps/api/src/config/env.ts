import dotenv from 'dotenv';
import path from 'path';

// Load .env from root or local directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

export const env = {
  PORT: parseInt(process.env.API_PORT || '5001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  SESSION_SECRET: process.env.SESSION_SECRET || 'quickstock-super-secure-jwt-secret-academic-prototype-key-2026',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quickstock_ai',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'quickstock_ai',
  ML_SERVICE_URL: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000',
  ML_SERVICE_TOKEN: process.env.ML_SERVICE_TOKEN || 'qs-internal-auth-token-quickstock-secure-key-2026',
  DATA_DIR: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data'),
  ARTIFACT_DIR: process.env.ARTIFACT_DIR ? path.resolve(process.env.ARTIFACT_DIR) : path.resolve(process.cwd(), 'artifacts'),
  DEMO_MODE: process.env.DEMO_MODE !== 'false'
};
