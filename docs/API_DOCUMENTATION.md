# QuickStock AI: API Documentation & OpenAPI Specification

Complete specification of Node.js Express Gateway and Private Python ML Microservice endpoints.

---

## 1. Node.js Express API Endpoints (Port 5001)

### Authentication
- `POST /api/auth/register` — Create new analyst user.
- `POST /api/auth/login` — Authenticate user, returns JWT and sets HTTP-only cookie `qs_token`.
- `GET /api/auth/me` — Retrieve active authenticated analyst profile.
- `POST /api/auth/logout` — Clear session cookies.

### Datasets & Ingestion
- `GET /api/datasets` — List all registered datasets.
- `GET /api/datasets/active` — Get currently active dataset.
- `POST /api/datasets/upload` — Upload CSV file via Multer (max 50MB). Enqueues asynchronous validation job.
- `POST /api/datasets/demo-seed` — Generate reproducible 36,500-row synthetic demo benchmark via Python ML service.
- `POST /api/datasets/:id/activate` — Set selected dataset as active benchmark.

### Stores & Products Master Catalog
- `GET /api/stores-products` — Paginated search and filter (`storeId`, `category`, `search`).
- `PUT /api/stores-products/:id` — Update inventory parameters (`lead_time_days`, `target_service_level`, `usable_on_hand`, `case_pack_size`, `min_order_qty`, etc.).
- `POST /api/stores-products/bulk-update` — Bulk update parameters for an entire store or category.

### Background Job Tracking
- `GET /api/jobs/:id` — Poll progress percent, status (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`), and error details.

### Machine Learning Models
- `GET /api/models/runs` — Retrieve leaderboard of all trained models and baselines.
- `GET /api/models/active` — Get active model run.
- `POST /api/models/train` — Enqueue model training job (`algorithm`, `target`, `mode`).
- `POST /api/models/:id/activate` — Activate model for downstream forecasting.

### Demand Forecasting
- `GET /api/forecasts/latest` — Retrieve latest multi-step forecast points with uncertainty bands.
- `POST /api/forecasts/run` — Enqueue recursive multi-step forecasting job (`horizonDays`: 1, 7, 14).

### Replenishment & Purchase Planning
- `POST /api/recommendations/generate` — Compute replenishment recommendations with constraint auditing.
- `GET /api/recommendations/plans` — List saved draft and approved plans.
- `GET /api/recommendations/plans/:id` — Get specific plan details.
- `POST /api/recommendations/plans` — Save draft replenishment plan.
- `PUT /api/recommendations/plans/:id/approve` — Approve plan (requires explicit confirmation). Updates local planning stock.

### Policy Simulation & Backtesting
- `GET /api/simulations/latest` — Get latest comparative backtest results.
- `POST /api/simulations/run` — Enqueue 3-policy simulation job.

### Reports & CSV Exports
- `POST /api/reports/generate-pdf` — Compile ReportLab academic executive summary PDF.
- `GET /api/reports/download/:filename` — Download generated PDF.
- `GET /api/reports/export/forecast-csv` — Export formula-escaped forecast CSV.
- `GET /api/reports/export/replenishment-csv` — Export formula-escaped replenishment CSV.

---

## 2. Python ML Microservice Endpoints (Port 8000)

Protected by `X-ML-Service-Token` header:

- `GET /health` — Service status and supported algorithm list.
- `POST /api/generate-demo-data` — Generates 36,500 rows synthetic dataset.
- `POST /api/validate-data` — Canonical schema mapping and quarantine file generation.
- `POST /api/train` — Chronological split model training and metric evaluation.
- `POST /api/forecast` — Recursive multi-step forecasting with calibrated intervals.
- `POST /api/recommend` — Replenishment order calculation and formula auditing.
- `POST /api/simulate` — Discrete-event continuous inventory ledger backtesting.
- `POST /api/generate-report` — ReportLab PDF document compilation.
