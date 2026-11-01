"""
QuickStock AI - Recursive Time-Safe Demand Forecaster
Generates multi-step forecasts (1, 7, 14 days) by iteratively updating lags
with predictions, preventing leakage and producing calibrated uncertainty intervals.
"""

import os
import joblib
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

def generate_forecasts(
    model_artifact_path: str,
    df_history: pd.DataFrame,
    horizon_days: int = 7,
    store_ids: Optional[List[str]] = None,
    product_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Produces genuine recursive time-safe forecasts for the specified horizon.
    """
    if not os.path.exists(model_artifact_path):
        raise FileNotFoundError(f"Model artifact not found at {model_artifact_path}")

    artifact = joblib.load(model_artifact_path)
    model = artifact["model"]
    feature_pipeline = artifact["feature_pipeline"]
    target_col = artifact["target_col"]
    feat_cols = artifact["feature_cols"]
    calibration = artifact.get("calibration", {"q_lower_error": -5.0, "q_upper_error": 5.0})

    q_lower = calibration.get("q_lower_error", -5.0)
    q_upper = calibration.get("q_upper_error", 5.0)

    # Filter history
    df = df_history.copy()
    if store_ids:
        df = df[df["store_id"].isin(store_ids)]
    if product_ids:
        df = df[df["product_id"].isin(product_ids)]

    last_historical_date = pd.to_datetime(df["date"].max())
    forecast_dates = [last_historical_date + timedelta(days=i) for i in range(1, horizon_days + 1)]

    # Get all active store-product series
    series_keys = df[["store_id", "product_id", "category", "region", "price", "discount", "promotion"]].drop_duplicates(subset=["store_id", "product_id"]).to_dict("records")

    # Global and category fallback averages for cold-start
    global_avg = float(df[target_col].mean()) if len(df) > 0 else 10.0
    cat_avg = df.groupby("category")[target_col].mean().to_dict()

    forecast_results: List[Dict[str, Any]] = []
    cold_start_count = 0

    # We maintain an extended simulation dataframe per series to recursively append predictions
    # Keep last 35 days of history for each series to compute 28-day lags and rolling statistics
    recent_history = df[df["date"] >= (last_historical_date - timedelta(days=35)).strftime("%Y-%m-%d")].copy()

    for item in series_keys:
        s_id = item["store_id"]
        p_id = item["product_id"]
        cat = item["category"]
        reg = item["region"]
        base_price = item["price"]
        base_disc = item["discount"]
        base_promo = item["promotion"]

        series_hist = recent_history[(recent_history["store_id"] == s_id) & (recent_history["product_id"] == p_id)].sort_values(by="date").copy()

        # Check for cold start (< 7 days of history)
        if len(series_hist) < 7:
            cold_start_count += 1
            fallback_val = float(cat_avg.get(cat, global_avg))
            for f_dt in forecast_dates:
                f_date_str = f_dt.strftime("%Y-%m-%d")
                forecast_results.append({
                    "date": f_date_str,
                    "store_id": s_id,
                    "product_id": p_id,
                    "predicted_mean": round(fallback_val, 2),
                    "lower_bound": round(max(0.0, fallback_val * 0.7), 2),
                    "upper_bound": round(fallback_val * 1.3, 2),
                    "is_cold_start": True
                })
            continue

        # Recursive Multi-Step Forecasting
        # Working series copies history and appends future predicted rows step by step
        sim_df = series_hist[["date", "store_id", "product_id", "category", "region", "price", "discount", "promotion", target_col]].copy()

        for step_idx, f_dt in enumerate(forecast_dates):
            f_date_str = f_dt.strftime("%Y-%m-%d")

            # Create candidate row for forecast step
            future_row = {
                "date": f_date_str,
                "store_id": s_id,
                "product_id": p_id,
                "category": cat,
                "region": reg,
                "price": base_price,
                "discount": base_disc,
                "promotion": base_promo,
                target_col: 0.0 # Placeholder
            }
            step_sim_df = pd.concat([sim_df, pd.DataFrame([future_row])], ignore_index=True)

            # Transform features up to current forecast step
            transformed = feature_pipeline.transform(step_sim_df)
            X_step = transformed[transformed["date"] == f_date_str][feat_cols]

            # Model point prediction
            raw_pred = float(model.predict(X_step)[0])
            pred_mean = max(0.0, round(raw_pred, 2))

            # Calibrated prediction intervals
            raw_lower = pred_mean + q_lower
            raw_upper = pred_mean + q_upper

            lower_bound = round(max(0.0, raw_lower), 2)
            upper_bound = round(max(pred_mean, raw_upper), 2)
            # Enforce monotonic bounds: lower <= mean <= upper
            if lower_bound > pred_mean:
                lower_bound = pred_mean
            if upper_bound < pred_mean:
                upper_bound = pred_mean

            forecast_results.append({
                "date": f_date_str,
                "store_id": s_id,
                "product_id": p_id,
                "predicted_mean": pred_mean,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "is_cold_start": False
            })

            # RECURSIVE UPDATE: update sim_df with the predicted target so next step reads it as historical lag!
            future_row[target_col] = pred_mean
            sim_df = pd.concat([sim_df, pd.DataFrame([future_row])], ignore_index=True)

    total_units = sum(pt["predicted_mean"] for pt in forecast_results)
    avg_per_day = round(total_units / (len(series_keys) * horizon_days), 2) if (len(series_keys) * horizon_days) > 0 else 0.0

    return {
        "modelRunId": artifact["model_id"],
        "target": target_col,
        "horizonDays": horizon_days,
        "forecasts": forecast_results,
        "summary": {
            "totalForecastUnits": round(total_units, 1),
            "avgDailyPerStoreProduct": avg_per_day,
            "coldStartCount": cold_start_count,
            "totalSeriesCount": len(series_keys)
        },
        "createdAt": datetime.now().isoformat()
    }
