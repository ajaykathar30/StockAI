# QuickStock AI: Machine Learning Methodology & Evaluation

Academic Demand Forecasting Specification for Quick-Commerce Dark Store Networks.

---

## 1. Problem Formulation & Boundaries

Quick-commerce dark stores operate on tight delivery windows (10–30 minutes) requiring daily inventory replenishment.
The forecasting task is formulated as a global regression problem across all $(s, p)$ store-product series:

$$\hat{y}_{s, p, t+h} = f\left(\mathbf{X}_{s, p, t}\right), \quad h \in \{1, \dots, H\}$$

Where:
- Frequency: **DAILY**. (No synthetic hourly records or shift-level accuracy claims are fabricated).
- Targets:
  1. `units_sold` (*Observed-Sales Forecast*, default): Reflects actual historical transactions, acknowledging stockout censoring limitations.
  2. `estimated_demand` (*Synthetic Estimated-Demand Forecast*, optional): Synthetic latent demand from benchmark datasets.

---

## 2. Feature Engineering & Strict Leakage Prevention

To ensure genuine real-world validity and prevent temporal lookahead leakage, the following rules are strictly enforced:

1. **Store-Product Isolation**:
   All time-series transformations are strictly grouped by `[store_id, product_id]` before sorting chronologically by date.
2. **Shifted Rolling Windows**:
   Rolling statistics (means over 7, 14, 28 days and standard deviations over 7, 28 days) are computed on $y_{t-1}$ (`shift(1)`). Under no circumstances is the current observation $y_t$ included in rolling features for day $t$.
3. **Target Proxy Exclusion**:
   Columns that mechanically correlate with ground truth sales (such as `units_ordered`, end-of-day `inventory_level`, or external `Demand Forecast` columns) are strictly excluded from the predictor matrix $\mathbf{X}$.
4. **Train-Only Preprocessing**:
   Categorical encodings and normalizers are fit exclusively on the chronological training split. Unseen future categories are mapped to an explicit unknown token (`-1`).

---

## 3. Evaluated Algorithms & Baselines

In accordance with academic standards, machine learning models are directly evaluated against established time-series baselines:

| Model | Category | Formulation / Strategy |
| :--- | :--- | :--- |
| **Previous-Day Naive** | Baseline | $\hat{y}_{t} = y_{t-1}$ |
| **Seasonal Naive (7-Day)** | Baseline | $\hat{y}_{t} = y_{t-7}$ (Same weekday of previous week) |
| **Trailing 7-Day Mean** | Baseline | $\hat{y}_{t} = \frac{1}{7}\sum_{i=1}^7 y_{t-i}$ |
| **Random Forest Regressor** | Machine Learning | Ensembled bagging of decision trees with bounded depth |
| **XGBoost Regressor** | Gradient Boosting | Gradient-boosted trees with depth 5–8, learning rate 0.08 |
| **LightGBM Regressor** | Gradient Boosting | Leaf-wise histogram boosting with early stopping on validation split |

---

## 4. Multi-Step Recursive Forecasting Protocol

For horizons $H \in \{1, 7, 14\}$ days:
- At step $t+1$, the model predicts $\hat{y}_{t+1}$.
- For step $t+2$, the lag-1 feature is populated with the predicted $\hat{y}_{t+1}$ (NOT the future actual value).
- Rolling features are recursively updated using the synthetic trajectory.
- **Cold-Start Fallback**: If an item has $<7$ days of history, a category-level empirical mean is used and flagged with `is_cold_start = true`.

---

## 5. Calibrated Prediction Intervals

Rather than assuming asymptotic normality, QuickStock AI uses empirical conformal calibration on the validation split:
- Lower residual quantile: $q_{10\%} = \text{Percentile}\left(\{y_{\text{val}} - \hat{y}_{\text{val}}\}, 10\right)$
- Upper residual quantile: $q_{90\%} = \text{Percentile}\left(\{y_{\text{val}} - \hat{y}_{\text{val}}\}, 90\right)$
- Bounds for day $t+h$:
  $$\text{Lower} = \max\left(0, \hat{y}_{t+h} + q_{10\%}\right)$$
  $$\text{Upper} = \max\left(\text{Lower}, \hat{y}_{t+h} + q_{90\%}\right)$$
- Quantile crossing is explicitly handled by enforcing $\text{Lower} \le \hat{y} \le \text{Upper}$.

---

## 6. Evaluation Metrics

All metrics are evaluated on an **untouched final 15% chronological test split**:

- **MAE**: $\frac{1}{N} \sum |y_i - \hat{y}_i|$
- **RMSE**: $\sqrt{\frac{1}{N} \sum (y_i - \hat{y}_i)^2}$
- **Zero-Safe WAPE**: $\frac{\sum |y_i - \hat{y}_i|}{\sum y_i + 10^{-6}}$
- **Zero-Safe sMAPE**: $\frac{1}{N} \sum \frac{200 \cdot |y_i - \hat{y}_i|}{|y_i| + |\hat{y}_i| + 10^{-6}}$
- **Interval Coverage**: $\frac{1}{N} \sum \mathbb{I}\left(\text{Lower}_i \le y_i \le \text{Upper}_i\right) \times 100\%$
