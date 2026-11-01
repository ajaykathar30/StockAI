"""
QuickStock AI - Time-Aware Feature Engineering & Leakage Prevention
Constructs historical lags, rolling statistics, and calendar attributes
strictly grouped by store-product series with no future peeking.
"""

import pandas as pd
import numpy as np
from typing import List, Tuple, Dict, Any
from sklearn.preprocessing import OrdinalEncoder

CATEGORICAL_COLS = ["store_id", "product_id", "category", "region"]
EXOGENOUS_NUMERIC_COLS = ["price", "discount", "promotion"]

class FeaturePipeline:
    def __init__(self, target_col: str = "units_sold"):
        self.target_col = target_col
        self.encoder = None
        self.feature_names: List[str] = []
        self.fitted_categories: Dict[str, List[Any]] = {}

    def extract_time_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        dt_series = pd.to_datetime(df["date"])
        df["dayofweek"] = dt_series.dt.day_of_week
        df["month"] = dt_series.dt.month
        df["day"] = dt_series.dt.day
        df["is_weekend"] = df["dayofweek"].isin([5, 6]).astype(int)
        return df

    def compute_lag_and_rolling(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Computes lag and rolling window statistics strictly grouped by store_id and product_id.
        LEAKAGE PREVENTION:
        Rolling calculations are computed on target shifted by 1 day so that
        the current observation target is NEVER included in rolling features.
        """
        df = df.copy()
        df = df.sort_values(by=["store_id", "product_id", "date"])

        grouped = df.groupby(["store_id", "product_id"])[self.target_col]

        # Historical lags
        df["target_lag_1"] = grouped.shift(1)
        df["target_lag_7"] = grouped.shift(7)
        df["target_lag_14"] = grouped.shift(14)
        df["target_lag_28"] = grouped.shift(28)

        # Shift target by 1 BEFORE computing rolling statistics to strictly avoid current-day leakage
        target_shifted_1 = grouped.shift(1)
        shifted_grouped = df.assign(_t_shift=target_shifted_1).groupby(["store_id", "product_id"])["_t_shift"]

        # Rolling means
        df["target_rolling_mean_7"] = shifted_grouped.transform(lambda s: s.rolling(window=7, min_periods=1).mean())
        df["target_rolling_mean_14"] = shifted_grouped.transform(lambda s: s.rolling(window=14, min_periods=1).mean())
        df["target_rolling_mean_28"] = shifted_grouped.transform(lambda s: s.rolling(window=28, min_periods=1).mean())

        # Rolling standard deviations
        df["target_rolling_std_7"] = shifted_grouped.transform(lambda s: s.rolling(window=7, min_periods=2).std()).fillna(0.0)
        df["target_rolling_std_28"] = shifted_grouped.transform(lambda s: s.rolling(window=28, min_periods=2).std()).fillna(0.0)

        # Past trend momentum (short vs long window momentum ratio)
        df["target_trend_ratio"] = (df["target_rolling_mean_7"] + 1e-4) / (df["target_rolling_mean_28"] + 1e-4)

        return df

    def fit(self, df_train: pd.DataFrame):
        """
        Fits categorical encoders strictly on the training partition.
        """
        df_feat = self.extract_time_features(df_train)
        df_feat = self.compute_lag_and_rolling(df_feat)

        # Fit ordinal encoder on categoricals
        cat_cols = [c for c in CATEGORICAL_COLS if c in df_feat.columns]
        self.encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
        self.encoder.fit(df_feat[cat_cols].astype(str))

        self.fitted_categories = {
            col: list(cats) for col, cats in zip(cat_cols, self.encoder.categories_)
        }

        # Determine feature names
        sample_transformed = self.transform(df_train.head(50))
        self.feature_names = [c for c in sample_transformed.columns if c not in ["date", self.target_col]]
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Transforms dataframe into machine learning feature matrix.
        Excludes target proxies, unshifted future columns, and end-of-day actuals.
        """
        df_feat = self.extract_time_features(df)
        df_feat = self.compute_lag_and_rolling(df_feat)

        # Apply fitted encoder
        cat_cols = [c for c in CATEGORICAL_COLS if c in df_feat.columns]
        if self.encoder is not None:
            encoded_cats = self.encoder.transform(df_feat[cat_cols].astype(str))
            for i, col in enumerate(cat_cols):
                df_feat[f"{col}_encoded"] = encoded_cats[:, i]

        # Features to retain
        feature_cols = [
            f"{c}_encoded" for c in cat_cols
        ] + [
            "dayofweek", "month", "day", "is_weekend",
            "price", "discount", "promotion",
            "target_lag_1", "target_lag_7", "target_lag_14", "target_lag_28",
            "target_rolling_mean_7", "target_rolling_mean_14", "target_rolling_mean_28",
            "target_rolling_std_7", "target_rolling_std_28",
            "target_trend_ratio"
        ]

        # Fill lag NAs for early series records with historical rolling fallback or median
        for col in ["target_lag_1", "target_lag_7", "target_lag_14", "target_lag_28"]:
            if col in df_feat.columns:
                df_feat[col] = df_feat[col].fillna(df_feat["target_rolling_mean_7"]).fillna(0.0)

        cols_to_keep = ["date"]
        if self.target_col in df_feat.columns:
            cols_to_keep.append(self.target_col)
        cols_to_keep.extend([c for c in feature_cols if c in df_feat.columns])

        return df_feat[cols_to_keep].copy()
