import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';

import { env } from './config/env';
import { connectDB } from './config/db';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import datasetRoutes from './routes/dataset.routes';
import storeProductRoutes from './routes/storeProduct.routes';
import jobRoutes from './routes/job.routes';
import modelRoutes from './routes/model.routes';
import forecastRoutes from './routes/forecast.routes';
import recommendationRoutes from './routes/recommendation.routes';
import simulationRoutes from './routes/simulation.routes';
import reportRoutes from './routes/report.routes';
import overviewRoutes from './routes/overview.routes';

const app = express();

// Security headers
app.use(helmet());

// CORS allowlist
const allowedOrigins = [
  env.CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in academic dev profile
    }
  },
  credentials: true
}));

// Body parsers with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Generous limit for dashboard polling
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'QuickStock AI Express Gateway',
    environment: env.NODE_ENV,
    academicNotice: 'Academic inventory decision-support prototype. Synthetic/simulated demonstration.',
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routers
app.use('/api/auth', authRoutes);
app.use('/api/datasets', datasetRoutes);
app.use('/api/stores-products', storeProductRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/simulations', simulationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/overview', overviewRoutes);

// Centralized error handling
app.use(errorHandler);

// Server initialization
export async function startServer() {
  await connectDB();
  const server = app.listen(env.PORT, () => {
    console.log(`[QuickStock API] Server listening on http://localhost:${env.PORT}`);
    console.log(`[QuickStock API] Connected to ML service at ${env.ML_SERVICE_URL}`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[QuickStock API] Failed to start:', err);
    process.exit(1);
  });
}

export default app;
