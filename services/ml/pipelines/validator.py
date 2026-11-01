"""
QuickStock AI - Dataset Validator & Provenance Engine
Validates incoming CSV data against canonical schema, flags inconsistencies,
and outputs an auditable import report with quarantined rows.
"""

import os
import re
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, List
from datetime import datetime

CANONICAL_COLUMNS = [
    "date", "store_id", "product_id", "category", "region",
    "inventory_level", "units_sold", "units_ordered", "price",
    "discount", "weather_condition", "promotion", "competitor_pricing",
    "seasonality", "epidemic", "estimated_demand"
]

COLUMN_SYNONYMS = {
    "date": ["date", "timestamp", "day", "txn_date", "record_date"],
    "store_id": ["store_id", "store", "storeid", "store_code", "dark_store_id"],
    "product_id": ["product_id", "sku", "productid", "item_id", "item_code"],
    "category": ["category", "dept", "department", "product_category"],
    "region": ["region", "zone", "location", "territory"],
    "inventory_level": ["inventory_level", "inventory", "stock", "stock_level", "on_hand"],
    "units_sold": ["units_sold", "sales", "qty_sold", "quantity_sold", "sold_units"],
    "units_ordered": ["units_ordered", "orders", "qty_ordered", "replenishment_units"],
    "price": ["price", "unit_price", "selling_price", "mrp"],
    "discount": ["discount", "disc", "discount_pct", "discount_percentage"],
    "weather_condition": ["weather_condition", "weather", "weather_type"],
    "promotion": ["promotion", "promo", "is_promo", "promotional_flag"],
    "competitor_pricing": ["competitor_pricing", "competitor_price", "comp_price"],
    "seasonality": ["seasonality", "seasonal_index"],
    "epidemic": ["epidemic", "outbreak", "crisis_flag"],
    "estimated_demand": ["estimated_demand", "demand", "latent_demand"]
}

def to_snake_case(text: str) -> str:
    s = re.sub(r'[\s\-_]+', '_', text.strip())
    s = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1_\2', s)
    s = re.sub(r'([a-z\d])([A-Z])', r'\1_\2', s)
    return s.lower()

def map_column_names(df_columns: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Maps arbitrary CSV columns to canonical columns using synonyms.
    Returns (mapping_dict: canonical -> csv_col, unmapped_columns).
    """
    mapping = {}
    normalized_cols = {to_snake_case(col): col for col in df_columns}

    for canonical, synonyms in COLUMN_SYNONYMS.items():
        matched = False
        for syn in synonyms:
            if syn in normalized_cols:
                mapping[canonical] = normalized_cols[syn]
                matched = True
                break
        if not matched and canonical in normalized_cols:
            mapping[canonical] = normalized_cols[canonical]

    mapped_csv_cols = set(mapping.values())
    unmapped = [col for col in df_columns if col not in mapped_csv_cols]
    return mapping, unmapped

def validate_dataset(df_raw: pd.DataFrame, quarantine_dir: str = "data/processed") -> Tuple[pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Validates raw dataframe, normalizes to canonical schema, detects anomalies,
    and isolates quarantined rows.
    """
    warnings: List[str] = []
    issues_summary: Dict[str, int] = {}

    def log_issue(issue_type: str, count: int = 1):
        issues_summary[issue_type] = issues_summary.get(issue_type, 0) + count

    # Step 1: Column mapping
    mapping, unmapped = map_column_names(list(df_raw.columns))
    original_columns_meta = {canonical: mapping.get(canonical) for canonical in CANONICAL_COLUMNS if canonical in mapping}

    if "Demand Forecast" in df_raw.columns or "demand_forecast" in [to_snake_case(c) for c in df_raw.columns]:
        warnings.append("Found 'Demand Forecast' column in dataset: Excluded from predictors and ground-truth targets to prevent circular leakage.")

    # Check required keys
    required_keys = ["date", "store_id", "product_id"]
    for req in required_keys:
        if req not in mapping:
            raise ValueError(f"Validation Error: Required canonical field '{req}' cannot be found in CSV columns.")

    # Rename mapped columns to canonical
    rename_dict = {orig: can for can, orig in mapping.items()}
    df = df_raw.rename(columns=rename_dict).copy()

    # Create missing optional canonical columns with defaults
    if "category" not in df.columns:
        df["category"] = "General"
        warnings.append("Missing 'category' column: Assigned default 'General'.")
    if "region" not in df.columns:
        df["region"] = "DefaultRegion"
        warnings.append("Missing 'region' column: Assigned default 'DefaultRegion'.")
    if "inventory_level" not in df.columns:
        df["inventory_level"] = 50.0
        warnings.append("Missing 'inventory_level' column: Imputed baseline 50.")
    if "units_sold" not in df.columns:
        df["units_sold"] = 0.0
        warnings.append("Missing 'units_sold' column: Initialized to 0.")
    if "units_ordered" not in df.columns:
        df["units_ordered"] = 0.0
    if "price" not in df.columns:
        df["price"] = 100.0
        warnings.append("Missing 'price' column: Imputed default 100.0.")
    if "discount" not in df.columns:
        df["discount"] = 0.0
    if "weather_condition" not in df.columns:
        df["weather_condition"] = "Normal"
    if "promotion" not in df.columns:
        df["promotion"] = 0
    if "seasonality" not in df.columns:
        df["seasonality"] = 1.0
    if "epidemic" not in df.columns:
        df["epidemic"] = 0
    if "estimated_demand" not in df.columns:
        df["estimated_demand"] = df["units_sold"].copy()

    # Ensure canonical columns only for downstream consistency
    df = df[[c for c in CANONICAL_COLUMNS if c in df.columns]].copy()

    # Tracking quarantined rows
    quarantine_mask = pd.Series(False, index=df.index)
    quarantine_reasons = pd.Series("", index=df.index, dtype=str)

    # 1. Date validation
    df["date_parsed"] = pd.to_datetime(df["date"], errors="coerce")
    invalid_dates = df["date_parsed"].isna()
    if invalid_dates.any():
        cnt = invalid_dates.sum()
        quarantine_mask |= invalid_dates
        quarantine_reasons[invalid_dates] += "Invalid date format; "
        log_issue("invalid_date_format", cnt)
        warnings.append(f"Flagged {cnt} rows with unparseable date formats.")

    # 2. String identifier validation
    missing_store = df["store_id"].isna() | (df["store_id"].astype(str).str.strip() == "")
    if missing_store.any():
        cnt = missing_store.sum()
        quarantine_mask |= missing_store
        quarantine_reasons[missing_store] += "Missing store_id; "
        log_issue("missing_store_id", cnt)

    missing_product = df["product_id"].isna() | (df["product_id"].astype(str).str.strip() == "")
    if missing_product.any():
        cnt = missing_product.sum()
        quarantine_mask |= missing_product
        quarantine_reasons[missing_product] += "Missing product_id; "
        log_issue("missing_product_id", cnt)

    # 3. Numeric fields & non-negativity
    numeric_cols = ["units_sold", "inventory_level", "units_ordered", "price", "discount"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        nan_mask = df[col].isna()
        if nan_mask.any():
            cnt = nan_mask.sum()
            quarantine_mask |= nan_mask
            quarantine_reasons[nan_mask] += f"Non-numeric value in {col}; "
            log_issue(f"non_numeric_{col}", cnt)

        neg_mask = (~df[col].isna()) & (df[col] < 0)
        if neg_mask.any():
            cnt = neg_mask.sum()
            quarantine_mask |= neg_mask
            quarantine_reasons[neg_mask] += f"Negative value in {col}; "
            log_issue(f"negative_{col}", cnt)

    # 4. Excessive discount (> 100%)
    excess_discount = (~df["discount"].isna()) & (df["discount"] > 100.0)
    if excess_discount.any():
        cnt = excess_discount.sum()
        quarantine_mask |= excess_discount
        quarantine_reasons[excess_discount] += "Discount exceeds 100%; "
        log_issue("excessive_discount", cnt)

    # 5. Duplicate keys (date + store_id + product_id)
    # Filter only among non-quarantined valid dates so far; keep first occurrence, quarantine duplicates
    candidate_valid = df[~quarantine_mask].copy()
    candidate_valid["date_str"] = candidate_valid["date_parsed"].dt.strftime("%Y-%m-%d")
    dup_mask = candidate_valid.duplicated(subset=["date_str", "store_id", "product_id"], keep="first")
    if dup_mask.any():
        dup_indices = candidate_valid[dup_mask].index
        quarantine_mask.loc[dup_indices] = True
        quarantine_reasons.loc[dup_indices] += "Duplicate date-store-product observation; "
        log_issue("duplicate_series_date", len(dup_indices))
        warnings.append(f"Flagged {len(dup_indices)} duplicate date-store-product records.")

    # 6. Metadata consistency check (Product assigned to conflicting categories)
    valid_df = df[~quarantine_mask].copy()
    if len(valid_df) > 0:
        prod_cats = valid_df.groupby("product_id")["category"].nunique()
        inconsistent_prods = prod_cats[prod_cats > 1].index.tolist()
        if inconsistent_prods:
            warnings.append(f"Contradictory metadata: Products assigned to multiple categories ({len(inconsistent_prods)} SKUs). Preserving dominant mapping.")

    # Separate valid and quarantined
    quarantined_df = df[quarantine_mask].copy()
    quarantined_df["quarantine_reason"] = quarantine_reasons[quarantine_mask]

    clean_df = df[~quarantine_mask].copy()
    clean_df["date"] = clean_df["date_parsed"].dt.strftime("%Y-%m-%d")
    clean_df = clean_df.drop(columns=["date_parsed"]).sort_values(by=["store_id", "product_id", "date"]).reset_index(drop=True)

    # Save quarantine file if problematic rows exist
    os.makedirs(quarantine_dir, exist_ok=True)
    quarantine_filepath = None
    if len(quarantined_df) > 0:
        quarantine_filename = f"quarantine_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        quarantine_filepath = os.path.join(quarantine_dir, quarantine_filename)
        quarantined_df.to_csv(quarantine_filepath, index=False)

    date_min = clean_df["date"].min() if len(clean_df) > 0 else "N/A"
    date_max = clean_df["date"].max() if len(clean_df) > 0 else "N/A"

    report = {
        "totalRows": int(len(df_raw)),
        "validRows": int(len(clean_df)),
        "quarantinedRows": int(len(quarantined_df)),
        "warnings": warnings,
        "issuesSummary": issues_summary,
        "quarantineFilePath": quarantine_filepath,
        "dateRange": {"start": str(date_min), "end": str(date_max)},
        "storeIds": sorted(clean_df["store_id"].unique().tolist()) if len(clean_df) > 0 else [],
        "productIds": sorted(clean_df["product_id"].unique().tolist()) if len(clean_df) > 0 else [],
        "categories": sorted(clean_df["category"].unique().tolist()) if len(clean_df) > 0 else [],
        "originalColumnsMeta": original_columns_meta
    }

    return clean_df, quarantined_df, report
