import pytest
import pandas as pd
import numpy as np

from pipelines.features import FeaturePipeline
from pipelines.trainer import calculate_metrics

def test_leakage_prevention_shifted_rolling_stats():
    """
    Verifies that for row t, target_rolling_mean_7 does NOT include the target from row t.
    """
    data = []
    # 10 days of observations where sales = day_idx * 10
    # Day 0: 0, Day 1: 10, Day 2: 20, Day 3: 30, Day 4: 40...
    for i in range(10):
        data.append({
            "date": f"2026-01-{i+1:02d}",
            "store_id": "STORE_A",
            "product_id": "PROD_1",
            "category": "Dairy",
            "region": "North",
            "units_sold": i * 10,
            "price": 50.0,
            "discount": 0.0,
            "promotion": 0
        })

    df = pd.DataFrame(data)
    pipeline = FeaturePipeline(target_col="units_sold")
    transformed = pipeline.compute_lag_and_rolling(df)

    # For Day 1 (index 1, where units_sold = 10):
    # rolling_mean_7 must ONLY reflect Day 0 (units_sold = 0)
    assert transformed.loc[transformed["date"] == "2026-01-02", "target_rolling_mean_7"].iloc[0] == 0.0

    # For Day 2 (index 2, where units_sold = 20):
    # rolling_mean_7 must be mean(0, 10) = 5.0, NOT including current Day 2!
    assert transformed.loc[transformed["date"] == "2026-01-03", "target_rolling_mean_7"].iloc[0] == 5.0

    # For Day 3 (index 3, units_sold = 30):
    # rolling_mean_7 must be mean(0, 10, 20) = 10.0
    assert transformed.loc[transformed["date"] == "2026-01-04", "target_rolling_mean_7"].iloc[0] == 10.0

def test_lag_grouping_isolation():
    """
    Verifies that lags for Store A Product 1 do NOT bleed into Store B Product 1.
    """
    data = [
        # Store A: sales 100 on Jan 1, 200 on Jan 2
        {"date": "2026-01-01", "store_id": "STORE_A", "product_id": "PROD_1", "category": "Dairy", "region": "North", "units_sold": 100, "price": 50.0, "discount": 0.0, "promotion": 0},
        {"date": "2026-01-02", "store_id": "STORE_A", "product_id": "PROD_1", "category": "Dairy", "region": "North", "units_sold": 200, "price": 50.0, "discount": 0.0, "promotion": 0},
        # Store B: sales 50 on Jan 1, 60 on Jan 2
        {"date": "2026-01-01", "store_id": "STORE_B", "product_id": "PROD_1", "category": "Dairy", "region": "South", "units_sold": 50, "price": 50.0, "discount": 0.0, "promotion": 0},
        {"date": "2026-01-02", "store_id": "STORE_B", "product_id": "PROD_1", "category": "Dairy", "region": "South", "units_sold": 60, "price": 50.0, "discount": 0.0, "promotion": 0},
    ]

    df = pd.DataFrame(data)
    pipeline = FeaturePipeline(target_col="units_sold")
    transformed = pipeline.compute_lag_and_rolling(df)

    store_b_jan2 = transformed[(transformed["store_id"] == "STORE_B") & (transformed["date"] == "2026-01-02")].iloc[0]
    # Lag 1 for Store B on Jan 2 must be 50 (Store B's Jan 1), NOT 200 (Store A)!
    assert store_b_jan2["target_lag_1"] == 50.0

def test_metrics_zero_denominator_handling():
    """
    Verifies that WAPE and sMAPE do not crash on all-zero actuals or predictions.
    """
    y_true = np.array([0.0, 0.0, 0.0])
    y_pred = np.array([0.0, 0.0, 0.0])

    metrics = calculate_metrics(y_true, y_pred)
    assert metrics["mae"] == 0.0
    assert metrics["rmse"] == 0.0
    assert metrics["wape"] == 0.0
    assert metrics["smape"] == 0.0
    assert not np.isnan(metrics["wape"])
    assert not np.isnan(metrics["smape"])
