import pytest
import pandas as pd
import numpy as np
import os
import shutil

from pipelines.validator import validate_dataset, map_column_names, to_snake_case

def test_to_snake_case():
    assert to_snake_case("Store ID") == "store_id"
    assert to_snake_case("UnitsSold") == "units_sold"
    assert to_snake_case("product_id") == "product_id"

def test_map_column_names():
    csv_cols = ["Date", "Store", "SKU", "Category", "Region", "Stock", "Sales", "Price"]
    mapping, unmapped = map_column_names(csv_cols)
    assert mapping["date"] == "Date"
    assert mapping["store_id"] == "Store"
    assert mapping["product_id"] == "SKU"
    assert mapping["units_sold"] == "Sales"
    assert mapping["inventory_level"] == "Stock"

def test_validation_quarantines_invalid_rows(tmp_path):
    quarantine_dir = str(tmp_path / "quarantine")
    raw_data = pd.DataFrame([
        # Valid row 1
        {"date": "2026-01-01", "store_id": "S1", "product_id": "P1", "units_sold": 10, "inventory_level": 50, "price": 100.0, "discount": 0.0},
        # Valid row 2
        {"date": "2026-01-02", "store_id": "S1", "product_id": "P1", "units_sold": 15, "inventory_level": 40, "price": 100.0, "discount": 5.0},
        # Invalid: unparseable date
        {"date": "invalid-date", "store_id": "S1", "product_id": "P1", "units_sold": 10, "inventory_level": 50, "price": 100.0, "discount": 0.0},
        # Invalid: negative sales
        {"date": "2026-01-03", "store_id": "S1", "product_id": "P1", "units_sold": -5, "inventory_level": 50, "price": 100.0, "discount": 0.0},
        # Invalid: discount > 100%
        {"date": "2026-01-04", "store_id": "S1", "product_id": "P1", "units_sold": 10, "inventory_level": 50, "price": 100.0, "discount": 150.0},
        # Duplicate of row 1
        {"date": "2026-01-01", "store_id": "S1", "product_id": "P1", "units_sold": 10, "inventory_level": 50, "price": 100.0, "discount": 0.0},
    ])

    clean_df, quarantined_df, report = validate_dataset(raw_data, quarantine_dir=quarantine_dir)

    assert len(clean_df) == 2 # Only row 1 and row 2 are valid (row 1's duplicate was caught)
    assert len(quarantined_df) == 4
    assert report["quarantinedRows"] == 4
    assert "invalid_date_format" in report["issuesSummary"]
    assert "negative_units_sold" in report["issuesSummary"]
    assert "excessive_discount" in report["issuesSummary"]
    assert "duplicate_series_date" in report["issuesSummary"]
    assert report["quarantineFilePath"] is not None
    assert os.path.exists(report["quarantineFilePath"])
