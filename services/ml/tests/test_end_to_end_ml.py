import pytest
import os
import pandas as pd
from pipelines.synthetic_generator import generate_demo_dataset
from pipelines.trainer import train_and_evaluate_model
from pipelines.forecaster import generate_forecasts
from pipelines.simulator import InventorySimulator
from pipelines.report_generator import generate_pdf_report

def test_full_ml_and_simulation_pipeline(tmp_path):
    # 1. Generate small demo dataset
    demo_csv = str(tmp_path / "test_sales.csv")
    df = generate_demo_dataset(output_path=demo_csv, seed=42, days=35)
    assert len(df) == 5 * 20 * 35 # 3500 rows

    # 2. Train baseline model (Seasonal Naive)
    artifact_dir = str(tmp_path / "models")
    naive_res = train_and_evaluate_model(
        df=df,
        target_col="units_sold",
        algorithm="seasonal_naive",
        mode="quick",
        artifact_dir=artifact_dir
    )
    assert naive_res["metrics"]["test"]["mae"] >= 0
    assert naive_res["metrics"]["test"]["rmse"] >= 0

    # 3. Train real boosting model (LightGBM)
    lgb_res = train_and_evaluate_model(
        df=df,
        target_col="units_sold",
        algorithm="lightgbm",
        mode="quick",
        artifact_dir=artifact_dir
    )
    assert lgb_res["metrics"]["test"]["mae"] >= 0
    assert len(lgb_res["featureImportance"]) > 0
    assert os.path.exists(lgb_res["artifactPath"])

    # 4. Generate 7-day recursive forecast
    fc_res = generate_forecasts(
        model_artifact_path=lgb_res["artifactPath"],
        df_history=df,
        horizon_days=7
    )
    assert len(fc_res["forecasts"]) == 5 * 20 * 7
    # Verify bounds consistency: lower <= mean <= upper
    for pt in fc_res["forecasts"][:20]:
        assert pt["lower_bound"] <= pt["predicted_mean"] + 1e-5
        assert pt["predicted_mean"] <= pt["upper_bound"] + 1e-5
        assert pt["predicted_mean"] >= 0

    # 5. Run inventory simulation
    unique_dates = sorted(df["date"].unique())
    test_df = df[df["date"] >= unique_dates[-10]].copy()
    simulator = InventorySimulator(lead_time_days=2, review_period_days=1)
    sim_res = simulator.run_simulation(test_df=test_df)
    assert "ml_driven_replenishment" in sim_res["results"]
    ml_policy = sim_res["results"]["ml_driven_replenishment"]
    assert ml_policy["fillRate"] >= 0 and ml_policy["fillRate"] <= 100.0

    # 6. Generate PDF report
    pdf_out = str(tmp_path / "test_report.pdf")
    rendered_path = generate_pdf_report(
        summary_data={
            "dataset": {"name": "Synthetic Test", "rowCount": len(df)},
            "target": "units_sold"
        },
        output_path=pdf_out
    )
    assert os.path.exists(rendered_path)
    assert os.path.getsize(rendered_path) > 1000 # Valid non-empty PDF
