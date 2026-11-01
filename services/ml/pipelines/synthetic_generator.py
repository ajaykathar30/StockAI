"""
QuickStock AI - Synthetic Demo Dataset Generator
Generates reproducible daily quick-commerce dark store demand and inventory records.
Academic prototype: synthetic data for demonstration, backtesting, and model benchmarks.
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

def generate_demo_dataset(output_path: str = None, seed: int = 42, days: int = 365) -> pd.DataFrame:
    """
    Generates synthetic daily inventory and sales dataset across 5 dark stores and 20 products for `days` days.
    Total records: 5 * 20 * 365 = 36,500 rows.
    """
    np.random.seed(seed)

    stores = [
        {"id": "DS_BLR_KORAMANGALA", "region": "South", "store_factor": 1.25},
        {"id": "DS_MUM_ANDHERI", "region": "West", "store_factor": 1.35},
        {"id": "DS_DEL_INDIRAPURAM", "region": "North", "store_factor": 1.10},
        {"id": "DS_PUN_KOTHRUD", "region": "West", "store_factor": 0.90},
        {"id": "DS_KOL_SALTLAKE", "region": "East", "store_factor": 0.80},
    ]

    products = [
        # Dairy (High turnover, perishable)
        {"id": "SKU_DAIRY_MILK_1L", "category": "Dairy", "base_demand": 75, "price": 64.0, "shelf_life": 3, "volatility": 0.15},
        {"id": "SKU_DAIRY_CURD_500G", "category": "Dairy", "base_demand": 45, "price": 40.0, "shelf_life": 5, "volatility": 0.18},
        {"id": "SKU_DAIRY_PANEER_200G", "category": "Dairy", "base_demand": 30, "price": 95.0, "shelf_life": 7, "volatility": 0.22},
        {"id": "SKU_DAIRY_BUTTER_100G", "category": "Dairy", "base_demand": 25, "price": 58.0, "shelf_life": 60, "volatility": 0.15},

        # Bakery (Short shelf life, weekend spikes)
        {"id": "SKU_BAKERY_BREAD_400G", "category": "Bakery", "base_demand": 50, "price": 45.0, "shelf_life": 4, "volatility": 0.20},
        {"id": "SKU_BAKERY_BURGER_BUNS_4P", "category": "Bakery", "base_demand": 20, "price": 35.0, "shelf_life": 4, "volatility": 0.30},
        {"id": "SKU_BAKERY_COOKIES_150G", "category": "Bakery", "base_demand": 22, "price": 75.0, "shelf_life": 90, "volatility": 0.20},

        # Fresh Produce (Daily perishables)
        {"id": "SKU_PROD_BANANA_1KG", "category": "Produce", "base_demand": 60, "price": 55.0, "shelf_life": 3, "volatility": 0.20},
        {"id": "SKU_PROD_TOMATO_1KG", "category": "Produce", "base_demand": 65, "price": 38.0, "shelf_life": 5, "volatility": 0.25},
        {"id": "SKU_PROD_POTATO_1KG", "category": "Produce", "base_demand": 80, "price": 32.0, "shelf_life": 14, "volatility": 0.12},
        {"id": "SKU_PROD_ONION_1KG", "category": "Produce", "base_demand": 70, "price": 42.0, "shelf_life": 14, "volatility": 0.14},

        # Beverages (Weekend & heat wave driven)
        {"id": "SKU_BEV_COLD_COFFEE_250ML", "category": "Beverages", "base_demand": 35, "price": 50.0, "shelf_life": 180, "volatility": 0.30},
        {"id": "SKU_BEV_GREEN_TEA_25B", "category": "Beverages", "base_demand": 14, "price": 180.0, "shelf_life": 365, "volatility": 0.20},
        {"id": "SKU_BEV_MINERAL_WATER_1L", "category": "Beverages", "base_demand": 90, "price": 20.0, "shelf_life": 365, "volatility": 0.15},

        # Snacks & Confectionery (High weekend evening demand)
        {"id": "SKU_SNACK_CHIPS_SALTED_100G", "category": "Snacks", "base_demand": 55, "price": 30.0, "shelf_life": 120, "volatility": 0.25},
        {"id": "SKU_SNACK_ROASTED_ALMONDS_200G", "category": "Snacks", "base_demand": 8, "price": 240.0, "shelf_life": 180, "volatility": 0.40}, # Low-demand/intermittent
        {"id": "SKU_SNACK_INSTANT_NOODLES_70G", "category": "Snacks", "base_demand": 85, "price": 14.0, "shelf_life": 270, "volatility": 0.18},

        # Home & Personal Care (Stable, non-perishable)
        {"id": "SKU_HOME_DISHWASH_500ML", "category": "Household", "base_demand": 18, "price": 110.0, "shelf_life": 730, "volatility": 0.15},
        {"id": "SKU_HOME_HANDWASH_REFILL_750ML", "category": "Household", "base_demand": 12, "price": 145.0, "shelf_life": 730, "volatility": 0.20},
        {"id": "SKU_HOME_TOILET_CLEANER_500ML", "category": "Household", "base_demand": 9, "price": 92.0, "shelf_life": 730, "volatility": 0.35}, # Low-demand
    ]

    end_date = datetime(2026, 10, 31)
    start_date = end_date - timedelta(days=days - 1)
    date_range = [start_date + timedelta(days=i) for i in range(days)]

    weather_types = ["Sunny", "Sunny", "Sunny", "Cloudy", "Rainy", "Humid"]

    records = []

    for store in stores:
        s_id = store["id"]
        s_region = store["region"]
        s_factor = store["store_factor"]

        for prod in products:
            p_id = prod["id"]
            p_cat = prod["category"]
            p_base = prod["base_demand"]
            p_price = prod["price"]
            p_volatility = prod["volatility"]

            # Initialize initial on-hand stock based on 3-day buffer
            current_inventory = int(p_base * s_factor * 3.5)

            for dt in date_range:
                date_str = dt.strftime("%Y-%m-%d")
                weekday = dt.weekday() # 0 = Mon, 6 = Sun
                month = dt.month

                # Day-of-week multiplier (Friday evening, Saturday, Sunday higher)
                if weekday in [4, 5, 6]:
                    dow_factor = 1.30 if p_cat in ["Snacks", "Beverages", "Bakery"] else 1.15
                else:
                    dow_factor = 0.92

                # Seasonal month factor (Monsoon in Jul-Aug boosts delivery/tea/noodles; summer boosts water/coffee)
                seasonal_factor = 1.0
                if month in [5, 6] and p_cat == "Beverages":
                    seasonal_factor = 1.35
                elif month in [7, 8] and p_cat in ["Snacks", "Dairy"]:
                    seasonal_factor = 1.15
                elif month in [10, 11]: # Festive season
                    seasonal_factor = 1.25

                # Promotional probability (approx 10% of days have a promotion)
                has_promo = 1 if np.random.rand() < 0.12 else 0
                promo_factor = 1.40 if has_promo else 1.0

                # Discount percentage (0-20% if promo, otherwise 0-5%)
                discount_pct = round(float(np.random.uniform(10.0, 25.0)), 1) if has_promo else (round(float(np.random.uniform(0.0, 5.0)), 1) if np.random.rand() < 0.15 else 0.0)
                effective_price = round(p_price * (1.0 - discount_pct / 100.0), 2)
                competitor_price = round(p_price * float(np.random.uniform(0.92, 1.08)), 2)

                weather = np.random.choice(weather_types)
                weather_factor = 1.15 if weather == "Rainy" and p_cat in ["Snacks", "Beverages"] else 1.0

                # Calculate synthetic latent demand (True demand before stock-out censoring)
                mean_demand = p_base * s_factor * dow_factor * seasonal_factor * promo_factor * weather_factor
                noise = np.random.normal(1.0, p_volatility)
                synthetic_latent_demand = max(0.0, mean_demand * noise)

                # Estimated demand (documented as synthetic daily estimated demand)
                estimated_demand = int(round(synthetic_latent_demand))

                # Units sold is capped by inventory available at start of day!
                # (Simulates realistic historical sales censoring due to stockouts)
                units_sold = min(current_inventory, estimated_demand)

                # End-of-day inventory update
                end_of_day_inventory = max(0, current_inventory - units_sold)

                # Units ordered by store manager (replenishment placed today to arrive in L days)
                # In historical records, units_ordered is logged
                reorder_target = int(p_base * s_factor * 3)
                units_ordered = max(0, reorder_target - end_of_day_inventory)

                records.append({
                    "date": date_str,
                    "store_id": s_id,
                    "product_id": p_id,
                    "category": p_cat,
                    "region": s_region,
                    "inventory_level": end_of_day_inventory,
                    "units_sold": units_sold,
                    "units_ordered": units_ordered,
                    "price": effective_price,
                    "discount": discount_pct,
                    "weather_condition": weather,
                    "promotion": has_promo,
                    "competitor_pricing": competitor_price,
                    "seasonality": round(seasonal_factor, 2),
                    "epidemic": 0,
                    "estimated_demand": estimated_demand
                })

                # Carry over inventory to next day + incoming restock
                current_inventory = end_of_day_inventory + units_ordered

    df = pd.DataFrame(records)

    if output_path:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        df.to_csv(output_path, index=False)
        print(f"[SyntheticGenerator] Successfully generated {len(df)} rows to {output_path}")

    return df

if __name__ == "__main__":
    out_file = os.path.join(os.path.dirname(__file__), "../../../data/demo/demo_sales_data.csv")
    generate_demo_dataset(out_file)
