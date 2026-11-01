"""
QuickStock AI - Python ML Microservice (FastAPI)
Exposes endpoints for dataset validation, model training, recursive forecasting,
inventory replenishment recommendations, policy simulations, and PDF report generation.
"""

import os
import sys
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd

# Add service directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pipelines.synthetic_generator import generate_demo_dataset
from pipelines.validator import validate_dataset
from pipelines.trainer import train_and_evaluate_model
from pipelines.forecaster import generate_forecasts
from pipelines.inventory import calculate_recommendations
from pipelines.simulator import InventorySimulator
from pipelines.report_generator import generate_pdf_report

ML_SERVICE_TOKEN = os.getenv("ML_SERVICE_TOKEN", "qs-internal-auth-token-quickstock-secure-key-2026")
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
DATA_DIR = os.getenv("DATA_DIR") or os.path.join(ROOT_DIR, "data")
ARTIFACT_DIR = os.getenv("ARTIFACT_DIR") or os.path.join(ROOT_DIR, "artifacts")
os.makedirs(os.path.join(DATA_DIR, "demo"), exist_ok=True)
os.makedirs(os.path.join(DATA_DIR, "processed"), exist_ok=True)
os.makedirs(os.path.join(ARTIFACT_DIR, "models"), exist_ok=True)
os.makedirs(os.path.join(ARTIFACT_DIR, "reports"), exist_ok=True)

app = FastAPI(
    title="QuickStock AI - Machine Learning & Inventory Decision Engine",
    version="1.0.0",
    description="Academic inventory decision-support microservice for quick-commerce dark stores."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_token(x_ml_service_token: Optional[str] = Header(None)):
    """Validates private service token for internal communication from Node API."""
    if not x_ml_service_token or x_ml_service_token != ML_SERVICE_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid ML service token."
        )

# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class GenerateDemoRequest(BaseModel):
    days: int = 365
    seed: int = 42

class ValidateDataRequest(BaseModel):
    filePath: str

class TrainModelRequest(BaseModel):
    datasetPath: str
    targetCol: str = "units_sold"
    algorithm: str = "lightgbm"
    mode: str = "quick" # "quick" or "full"
    randomSeed: int = 42

class ForecastRequest(BaseModel):
    modelArtifactPath: str
    datasetPath: str
    horizonDays: int = 7
    storeIds: Optional[List[str]] = None
    productIds: Optional[List[str]] = None

class RecommendRequest(BaseModel):
    params: List[Dict[str, Any]]
    forecastsBySeries: Dict[str, List[Dict[str, Any]]]
    warehouseCapacityLimit: Optional[int] = None
    procurementBudgetLimit: Optional[float] = None

class SimulateRequest(BaseModel):
    datasetPath: str
    forecastArtifactPath: Optional[str] = None
    targetCol: str = "units_sold"
    leadTimeDays: int = 2
    reviewPeriodDays: int = 1
    holdingCostRate: float = 0.05
    shortagePenaltyRate: float = 15.0
    trackPerishability: bool = True
    defaultShelfLifeDays: int = 7

class GenerateReportRequest(BaseModel):
    summaryData: Dict[str, Any]

# ==========================================
# API ENDPOINTS
# ==========================================

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "QuickStock AI ML Engine",
        "pythonVersion": sys.version,
        "academicNotice": "Academic inventory decision-support prototype. Synthetic/simulated demonstration.",
        "algorithmsSupported": [
            "previous_day_naive",
            "seasonal_naive",
            "trailing_7d_mean",
            "random_forest",
            "xgboost",
            "lightgbm"
        ]
    }

@app.post("/api/generate-demo-data", dependencies=[Depends(verify_token)])
def api_generate_demo_data(req: GenerateDemoRequest):
    try:
        out_path = os.path.join(DATA_DIR, "demo", "demo_sales_data.csv")
        df = generate_demo_dataset(output_path=out_path, seed=req.seed, days=req.days)
        return {
            "success": True,
            "filePath": out_path,
            "rowCount": len(df),
            "storesCount": int(df["store_id"].nunique()),
            "productsCount": int(df["product_id"].nunique()),
            "startDate": str(df["date"].min()),
            "endDate": str(df["date"].max()),
            "isSynthetic": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/validate-data", dependencies=[Depends(verify_token)])
def api_validate_data(req: ValidateDataRequest):
    if not os.path.exists(req.filePath):
        raise HTTPException(status_code=404, detail=f"File not found at {req.filePath}")
    try:
        df_raw = pd.read_csv(req.filePath)
        quarantine_dir = os.path.join(DATA_DIR, "processed")
        clean_df, quarantined_df, report = validate_dataset(df_raw, quarantine_dir=quarantine_dir)

        # Save validated clean CSV
        clean_path = os.path.join(DATA_DIR, "processed", f"validated_{os.path.basename(req.filePath)}")
        clean_df.to_csv(clean_path, index=False)
        report["validatedCleanPath"] = clean_path

        return {
            "success": True,
            "report": report
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/train", dependencies=[Depends(verify_token)])
def api_train(req: TrainModelRequest):
    if not os.path.exists(req.datasetPath):
        raise HTTPException(status_code=404, detail=f"Dataset not found at {req.datasetPath}")
    try:
        df = pd.read_csv(req.datasetPath)
        models_dir = os.path.join(ARTIFACT_DIR, "models")
        result = train_and_evaluate_model(
            df=df,
            target_col=req.targetCol,
            algorithm=req.algorithm,
            mode=req.mode,
            artifact_dir=models_dir,
            random_seed=req.randomSeed
        )
        return {"success": True, "model": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/forecast", dependencies=[Depends(verify_token)])
def api_forecast(req: ForecastRequest):
    if not os.path.exists(req.modelArtifactPath):
        raise HTTPException(status_code=404, detail=f"Model artifact not found at {req.modelArtifactPath}")
    if not os.path.exists(req.datasetPath):
        raise HTTPException(status_code=404, detail=f"Dataset not found at {req.datasetPath}")
    try:
        df = pd.read_csv(req.datasetPath)
        result = generate_forecasts(
            model_artifact_path=req.modelArtifactPath,
            df_history=df,
            horizon_days=req.horizonDays,
            store_ids=req.storeIds,
            product_ids=req.productIds
        )
        return {"success": True, "forecast": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/recommend", dependencies=[Depends(verify_token)])
def api_recommend(req: RecommendRequest):
    try:
        result = calculate_recommendations(
            params_list=req.params,
            forecasts_by_series=req.forecastsBySeries,
            warehouse_capacity_limit=req.warehouseCapacityLimit,
            procurement_budget_limit=req.procurementBudgetLimit
        )
        return {"success": True, "recommendations": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate", dependencies=[Depends(verify_token)])
def api_simulate(req: SimulateRequest):
    if not os.path.exists(req.datasetPath):
        raise HTTPException(status_code=404, detail=f"Dataset not found at {req.datasetPath}")
    try:
        df = pd.read_csv(req.datasetPath)
        # Use last 45 days of dataset as the test evaluation period
        unique_dates = sorted(df["date"].unique())
        sim_start_idx = max(0, len(unique_dates) - 45)
        test_df = df[df["date"] >= unique_dates[sim_start_idx]].copy()

        simulator = InventorySimulator(
            lead_time_days=req.leadTimeDays,
            review_period_days=req.reviewPeriodDays,
            holding_cost_rate=req.holdingCostRate,
            shortage_penalty_rate=req.shortagePenaltyRate,
            track_perishability=req.trackPerishability,
            default_shelf_life_days=req.defaultShelfLifeDays
        )
        result = simulator.run_simulation(test_df=test_df, target_col=req.targetCol)
        return {"success": True, "simulation": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-report", dependencies=[Depends(verify_token)])
def api_generate_report(req: GenerateReportRequest):
    try:
        reports_dir = os.path.join(ARTIFACT_DIR, "reports")
        os.makedirs(reports_dir, exist_ok=True)
        report_path = generate_pdf_report(summary_data=req.summaryData)
        return {
            "success": True,
            "reportPath": report_path,
            "filename": os.path.basename(report_path)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download-report")
def api_download_report(filename: str):
    # Path traversal safeguard
    clean_filename = os.path.basename(filename)
    path = os.path.join(ARTIFACT_DIR, "reports", clean_filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report file not found.")
    return FileResponse(path, media_type="application/pdf", filename=clean_filename)
