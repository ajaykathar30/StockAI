# How to Run QuickStock AI (Agent & Human Guide)

> **Audience**: AI Agents, Autonomous Systems, and Developers cloning this repository.  
> **Purpose**: Deterministic, end-to-end instructions to configure, seed, test, and run the complete QuickStock AI stack.

---

## 1. Architecture Overview

QuickStock AI consists of three interconnected services:

| Component | Directory | Port | Tech Stack | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Python ML Engine** | `services/ml/` | `8000` | FastAPI, Pydantic, LightGBM, XGBoost, ReportLab | Forecasting, validation, replenishment policy, simulation |
| **API Gateway** | `apps/api/` | `5001` | Express, TypeScript, Mongoose, Multer | REST gateway, MongoDB persistence, job queue |
| **Web Frontend** | `apps/web/` | `5173` | React 18, Vite, TypeScript, Tailwind, Recharts | Dashboard UI with `/api` reverse proxy to Gateway |
| **Database** | External | `27017` | MongoDB 7.0 / MongoDB Atlas | Persistent document storage |

```
Browser Client (:5173) ──> Express Gateway (:5001) ──> MongoDB (:27017)
                                 │
                                 └──> FastAPI ML Service (:8000)
```

---

## 2. System Prerequisites

Ensure the host environment has:
- **Node.js**: `v20.x` or `v22.x` / `v23.x` (`node -v`)
- **npm**: `v10.x+` (`npm -v`)
- **Python**: `3.11+` (`python3 --version`)
- **MongoDB**: `7.0+` running locally on port `27017` OR a MongoDB Atlas cluster connection string.
  - To verify local MongoDB: `nc -zv 127.0.0.1 27017` or `brew services list` or `docker run -d -p 27017:27017 --name mongo mongo:7.0`

---

## 3. Step-by-Step Setup from a Clean Clone

Execute each command from the repository root:

```bash
# Clone the repository (if not already cloned)
git clone https://github.com/ajaykathar30/StockAI.git
cd StockAI
```

### Step 3.1: Configure Environment Variables
Copy the provided environment template:
```bash
cp .env.example .env
```
Default values inside `.env` work out of the box for local development:
```env
API_PORT=5001
CLIENT_ORIGIN=http://localhost:5173
SESSION_SECRET=quickstock-super-secure-jwt-secret-academic-prototype-key-2026
MONGODB_URI=mongodb://127.0.0.1:27017/quickstock_ai
MONGODB_DB_NAME=quickstock_ai
ML_SERVICE_URL=http://127.0.0.1:8000
ML_SERVICE_TOKEN=qs-internal-auth-token-quickstock-secure-key-2026
```
*(If using MongoDB Atlas, replace `MONGODB_URI` with your connection string).*

---

### Step 3.2: Set Up Python ML Service & Virtual Environment
```bash
cd services/ml
python3 -m venv venv
./venv/bin/pip install --upgrade pip setuptools wheel
./venv/bin/pip install -r requirements.txt
cd ../..
```

---

### Step 3.3: Install Node.js Workspaces & Build Shared Package
```bash
# Install all root and workspace dependencies
npm install

# Build the shared TypeScript contract library
npm --workspace=@quickstock/shared run build
```

---

### Step 3.4: Seed Initial Data & Analyst Account
Seed demo dark-store products, synthetic datasets, and default analyst credentials into MongoDB:
```bash
npm run seed
```
*(Outputs `[Seed] Finished successfully.`)*

---

### Step 3.5: Run Automated Verification Tests (Optional but Recommended)
Run Python ML tests (10 test cases including leakage checks & inventory policies):
```bash
npm run test:ml
```
Run Express API integration tests:
```bash
npm run test:api
```

---

## 4. Starting the Application

Choose **one** of the following execution methods:

### Method A: Concurrently (All 3 Services at Once) — Recommended
Starts the ML engine, Express API, and Vite web server together in a single command:
```bash
npm run dev
```

### Method B: Separate Terminals (for Dedicated Log Streaming)
Open 3 terminal windows:

- **Terminal 1 (Python ML Microservice — Port 8000):**
  ```bash
  npm run dev:ml
  # Or: cd services/ml && ./venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
  ```

- **Terminal 2 (Node Express API Gateway — Port 5001):**
  ```bash
  npm run dev:api
  # Or: cd apps/api && npm run dev
  ```

- **Terminal 3 (React Vite Frontend — Port 5173):**
  ```bash
  npm run dev:web
  # Or: cd apps/web && npm run dev
  ```

### Method C: Docker Compose (All-in-One Containerized)
If Docker and Docker Compose are installed:
```bash
docker compose up --build
```

---

## 5. Verification & Health Checks (For AI Agents)

Once services are running, run these HTTP curl checks to verify proper functioning:

```bash
# 1. Verify ML Service (FastAPI)
curl -s http://127.0.0.1:8000/health
# Expected JSON output: {"status":"ok","service":"QuickStock AI ML Engine", ...}

# 2. Verify API Gateway (Express)
curl -s http://localhost:5001/health
# Expected JSON output: {"status":"ok","service":"QuickStock AI Express Gateway", ...}

# 3. Verify Database Connectivity & Aggregated Stats
curl -s http://localhost:5001/api/overview/stats
# Expected JSON output: {"success":true,"stats":{"dataset":{...},"activeLocationsCount":5,...}}

# 4. Verify Frontend Server & Reverse Proxy
curl -s http://localhost:5173/api/overview/stats
# Expected JSON output: Same JSON returned through Vite proxy
```

---

## 6. Accessing the User Interface

- **URL**: Open [http://localhost:5173](http://localhost:5173) in your browser.
- **Default Analyst Account**:
  - **Email**: `analyst@quickstock.local`
  - **Password**: `quickstock123`

---

## 7. Troubleshooting & Edge Cases

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| `EADDRINUSE: address already in use :::5001` (or 8000, 5173) | A previously detached dev process is still running. | Run `lsof -ti :8000,:5001,:5173 \| xargs kill -9` |
| `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017` | MongoDB daemon is not running. | Start mongod: `brew services start mongodb-community` or `docker run -d -p 27017:27017 mongo:7.0` |
| `No module named 'fastapi'` or Python errors | Python dependencies were not installed into `./venv`. | Re-run `cd services/ml && ./venv/bin/pip install -r requirements.txt` |
| `Cannot find module '@quickstock/shared'` | Shared package was not built. | Run `npm --workspace=@quickstock/shared run build` |
| `sh: concurrently: command not found` | Root dependencies not installed. | Run `npm install` in the repository root. |
