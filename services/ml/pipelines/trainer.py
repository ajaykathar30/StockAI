"""
QuickStock AI - ML Training & Evaluation Engine
Trains baselines (Naive, Seasonal Naive, 7d Mean, Random Forest)
and gradient boosting models (XGBoost, LightGBM) with chronological validation splits.
"""

import os
import time
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, List, Optional
from datetime import datetime

from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance
import xgboost as xgb
import lightgbm as lgb

from pipelines.features import FeaturePipeline

def calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Computes MAE, RMSE, WAPE, and sMAPE with strict zero handling.
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.maximum(0.0, np.asarray(y_pred, dtype=float)) # Demand is nonnegative

    mae = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))

    # WAPE with zero denominator handling
    sum_true = float(np.sum(y_true))
    wape = float(np.sum(np.abs(y_true - y_pred)) / (sum_true + 1e-6))

    # sMAPE with defined zero handling
    denom = np.abs(y_true) + np.abs(y_pred) + 1e-6
    smape = float(np.mean(200.0 * np.abs(y_true - y_pred) / denom))

    return {
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "wape": round(wape, 4),
        "smape": round(smape, 2)
    }

class BaselineModel:
    """
    Implements rule-based time series baselines:
    - previous_day_naive: y[t] = lag_1
    - seasonal_naive: y[t] = lag_7
    - trailing_7d_mean: y[t] = rolling_mean_7
    """
    def __init__(self, baseline_type: str = "previous_day_naive"):
        self.baseline_type = baseline_type
        self.feature_name = {
            "previous_day_naive": "target_lag_1",
            "seasonal_naive": "target_lag_7",
            "trailing_7d_mean": "target_rolling_mean_7"
        }.get(baseline_type, "target_lag_1")

    def fit(self, X: pd.DataFrame, y: pd.Series):
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if self.feature_name in X.columns:
            return np.maximum(0.0, X[self.feature_name].fillna(0.0).values)
        return np.zeros(len(X))

def train_and_evaluate_model(
    df: pd.DataFrame,
    target_col: str = "units_sold",
    algorithm: str = "lightgbm",
    mode: str = "quick",
    artifact_dir: str = "artifacts/models",
    random_seed: int = 42
) -> Dict[str, Any]:
    """
    Executes chronological split, feature extraction, model fitting, metric evaluation,
    and artifact serialization.
    """
    start_time = time.time()
    np.random.seed(random_seed)

    # 1. Chronological Splitting
    unique_dates = sorted(df["date"].unique())
    n_dates = len(unique_dates)
    if n_dates < 14:
        raise ValueError(f"Insufficient historical dates ({n_dates} days). Minimum 14 required.")

    train_cutoff_idx = int(n_dates * 0.70)
    val_cutoff_idx = int(n_dates * 0.85)

    train_end_date = unique_dates[train_cutoff_idx - 1]
    val_end_date = unique_dates[val_cutoff_idx - 1]
    test_end_date = unique_dates[-1]

    train_df = df[df["date"] <= train_end_date].copy()
    val_df = df[(df["date"] > train_end_date) & (df["date"] <= val_end_date)].copy()
    test_df = df[df["date"] > val_end_date].copy()

    # 2. Fit feature pipeline on training set ONLY
    feature_pipeline = FeaturePipeline(target_col=target_col)
    feature_pipeline.fit(train_df)

    # Transform chronological sets
    # We pass the full preceding context to compute lags accurately for validation and test
    full_df = df.copy()
    full_transformed = feature_pipeline.transform(full_df)

    feat_cols = [c for c in full_transformed.columns if c not in ["date", target_col]]

    X_train = full_transformed[full_transformed["date"] <= train_end_date][feat_cols]
    y_train = full_transformed[full_transformed["date"] <= train_end_date][target_col].values

    X_val = full_transformed[(full_transformed["date"] > train_end_date) & (full_transformed["date"] <= val_end_date)][feat_cols]
    y_val = full_transformed[(full_transformed["date"] > train_end_date) & (full_transformed["date"] <= val_end_date)][target_col].values

    X_test = full_transformed[full_transformed["date"] > val_end_date][feat_cols]
    y_test = full_transformed[full_transformed["date"] > val_end_date][target_col].values

    model = None
    hyperparams: Dict[str, Any] = {"random_state": random_seed}
    native_importances: List[Dict[str, Any]] = []

    # 3. Model instantiation & training
    if algorithm in ["previous_day_naive", "seasonal_naive", "trailing_7d_mean"]:
        model = BaselineModel(baseline_type=algorithm)
        model.fit(X_train, y_train)

    elif algorithm == "random_forest":
        n_estimators = 50 if mode == "quick" else 120
        max_depth = 12 if mode == "quick" else 18
        hyperparams.update({"n_estimators": n_estimators, "max_depth": max_depth})
        model = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_seed,
            n_jobs=-1
        )
        model.fit(X_train, y_train)
        if hasattr(model, "feature_importances_"):
            for feat, imp in zip(feat_cols, model.feature_importances_):
                native_importances.append({"feature": feat, "importance": round(float(imp), 4), "type": "native"})

    elif algorithm == "xgboost":
        n_estimators = 60 if mode == "quick" else 150
        max_depth = 5 if mode == "quick" else 8
        lr = 0.08
        hyperparams.update({"n_estimators": n_estimators, "max_depth": max_depth, "learning_rate": lr})
        model = xgb.XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=lr,
            random_state=random_seed,
            n_jobs=-1
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=False
        )
        if hasattr(model, "feature_importances_"):
            for feat, imp in zip(feat_cols, model.feature_importances_):
                native_importances.append({"feature": feat, "importance": round(float(imp), 4), "type": "native"})

    elif algorithm == "lightgbm":
        n_estimators = 80 if mode == "quick" else 180
        num_leaves = 31 if mode == "quick" else 63
        lr = 0.06
        hyperparams.update({"n_estimators": n_estimators, "num_leaves": num_leaves, "learning_rate": lr})
        model = lgb.LGBMRegressor(
            n_estimators=n_estimators,
            num_leaves=num_leaves,
            learning_rate=lr,
            random_state=random_seed,
            n_jobs=-1,
            verbosity=-1
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(stopping_rounds=15, verbose=False)]
        )
        if hasattr(model, "feature_importances_"):
            total_imp = float(np.sum(model.feature_importances_)) + 1e-6
            for feat, imp in zip(feat_cols, model.feature_importances_):
                native_importances.append({"feature": feat, "importance": round(float(imp) / total_imp, 4), "type": "native"})
    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")

    # Sort native feature importances descending
    native_importances.sort(key=lambda x: x["importance"], reverse=True)

    # 4. Predictions & Metrics
    val_preds = np.maximum(0.0, model.predict(X_val))
    test_preds = np.maximum(0.0, model.predict(X_test))

    val_metrics = calculate_metrics(y_val, val_preds)
    test_metrics = calculate_metrics(y_test, test_preds)

    # 5. Uncertainty / Conformal prediction interval calibration
    # Calculate empirical residuals on validation set (10th and 90th percentiles)
    val_residuals = y_val - val_preds
    q_lower_error = float(np.percentile(val_residuals, 10)) # e.g. -12.5
    q_upper_error = float(np.percentile(val_residuals, 90)) # e.g. +14.2

    # Verify coverage on test set
    test_lower_band = np.maximum(0.0, test_preds + q_lower_error)
    test_upper_band = np.maximum(test_lower_band, test_preds + q_upper_error)
    in_interval = (y_test >= test_lower_band) & (y_test <= test_upper_band)
    interval_coverage = round(float(np.mean(in_interval)) * 100.0, 2)
    test_metrics["intervalCoverage"] = interval_coverage

    # Category breakdown for test set
    category_metrics: Dict[str, Any] = {}
    test_eval_df = test_df.copy()
    test_eval_df["y_true"] = y_test
    test_eval_df["y_pred"] = test_preds
    for cat, cat_grp in test_eval_df.groupby("category"):
        category_metrics[cat] = calculate_metrics(cat_grp["y_true"].values, cat_grp["y_pred"].values)

    # 6. Save artifact
    model_id = f"model_{algorithm}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    os.makedirs(artifact_dir, exist_ok=True)
    artifact_path = os.path.join(artifact_dir, f"{model_id}.joblib")

    artifact_bundle = {
        "model_id": model_id,
        "algorithm": algorithm,
        "target_col": target_col,
        "feature_pipeline": feature_pipeline,
        "model": model,
        "feature_cols": feat_cols,
        "hyperparams": hyperparams,
        "calibration": {
            "q_lower_error": q_lower_error,
            "q_upper_error": q_upper_error,
            "val_rmse": val_metrics["rmse"]
        },
        "metrics": {
            "validation": val_metrics,
            "test": test_metrics,
            "byCategory": category_metrics
        },
        "train_split": {
            "trainEnd": str(train_end_date),
            "valEnd": str(val_end_date),
            "testEnd": str(test_end_date),
            "trainRows": len(X_train),
            "valRows": len(X_val),
            "testRows": len(X_test)
        },
        "created_at": datetime.now().isoformat(),
        "random_seed": random_seed
    }
    joblib.dump(artifact_bundle, artifact_path)

    elapsed = round(time.time() - start_time, 2)

    return {
        "modelId": model_id,
        "algorithm": algorithm,
        "target": target_col,
        "hyperparameters": hyperparams,
        "trainSplitDates": {
            "trainEnd": str(train_end_date),
            "valEnd": str(val_end_date),
            "testEnd": str(test_end_date)
        },
        "metrics": {
            "validation": val_metrics,
            "test": test_metrics,
            "byCategory": category_metrics
        },
        "featureImportance": native_importances[:12],
        "artifactPath": artifact_path,
        "elapsedSeconds": elapsed,
        "createdAt": datetime.now().isoformat()
    }
