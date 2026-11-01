"""
QuickStock AI - Discrete-Event Inventory Backtester & Policy Simulator
Simulates a continuous operational inventory ledger across historical test periods,
comparing Fixed ROP, Moving-Average Order-Up-To, and ML-Driven Replenishment policies.
"""

import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime

class InventorySimulator:
    def __init__(
        self,
        lead_time_days: int = 2,
        review_period_days: int = 1,
        holding_cost_rate: float = 0.05,
        shortage_penalty_rate: float = 15.0,
        order_placement_cost: float = 25.0,
        track_perishability: bool = True,
        default_shelf_life_days: int = 7
    ):
        self.lead_time_days = lead_time_days
        self.review_period_days = review_period_days
        self.holding_cost_rate = holding_cost_rate
        self.shortage_penalty_rate = shortage_penalty_rate
        self.order_placement_cost = order_placement_cost
        self.track_perishability = track_perishability
        self.default_shelf_life_days = default_shelf_life_days

    def run_simulation(
        self,
        test_df: pd.DataFrame,
        forecast_df: Optional[pd.DataFrame] = None,
        target_col: str = "units_sold"
    ) -> Dict[str, Any]:
        """
        Runs comparative simulation across 3 replenishment policies on identical demand timelines.
        """
        # Ensure chronological ordering
        df = test_df.sort_values(by="date").copy()
        unique_dates = sorted(df["date"].unique())

        if len(unique_dates) == 0:
            raise ValueError("Test dataframe has 0 dates.")

        policies = ["fixed_reorder_point", "moving_average_order_up_to", "ml_driven_replenishment"]
        policy_names = {
            "fixed_reorder_point": "Fixed Reorder-Point Policy (s, Q)",
            "moving_average_order_up_to": "Moving-Average Order-Up-To Policy",
            "ml_driven_replenishment": "QuickStock ML-Driven Replenishment"
        }

        results = {}

        # Precompute daily series demand
        # series: (store_id, product_id)
        series_keys = df[["store_id", "product_id", "category"]].drop_duplicates().to_dict("records")

        # Map forecast by (store, product, date)
        forecast_map = {}
        if forecast_df is not None and len(forecast_df) > 0:
            for _, r in forecast_df.iterrows():
                key = (str(r["store_id"]), str(r["product_id"]), str(r["date"]))
                forecast_map[key] = float(r.get("predicted_mean", 0.0))

        # Run simulation per policy
        for p_type in policies:
            results[p_type] = self._simulate_single_policy(
                policy_type=p_type,
                unique_dates=unique_dates,
                df_demand=df,
                series_keys=series_keys,
                forecast_map=forecast_map,
                target_col=target_col
            )
            results[p_type]["policyName"] = policy_names[p_type]

        return {
            "testStartDate": unique_dates[0],
            "testEndDate": unique_dates[-1],
            "results": results,
            "assumptions": {
                "leadTimeDays": self.lead_time_days,
                "reviewPeriodDays": self.review_period_days,
                "holdingCostDailyRate": self.holding_cost_rate,
                "shortagePenaltyPerUnit": self.shortage_penalty_rate,
                "orderPlacementCost": self.order_placement_cost,
                "trackPerishability": self.track_perishability,
                "defaultShelfLifeDays": self.default_shelf_life_days
            },
            "limitationsDisclaimer": (
                "Academic inventory decision-support prototype. "
                "Simulated outcomes are synthetic replays. Observed-sales replay is an operational proxy "
                "and does not reconstruct unobserved latent demand during historical stock-outs."
            ),
            "createdAt": datetime.now().isoformat()
        }

    def _simulate_single_policy(
        self,
        policy_type: str,
        unique_dates: List[str],
        df_demand: pd.DataFrame,
        series_keys: List[Dict[str, Any]],
        forecast_map: Dict[Any, float],
        target_col: str
    ) -> Dict[str, Any]:
        """
        Executes daily ledger steps for a given policy.
        """
        # Global metrics accumulator
        total_requested = 0.0
        total_fulfilled = 0.0
        total_lost_sales = 0.0
        total_holding_cost = 0.0
        total_shortage_cost = 0.0
        total_ordering_cost = 0.0
        total_waste_cost = 0.0
        total_expired_units = 0.0
        stockout_days_count = 0
        daily_on_hand_sum = 0.0

        daily_ledger = []

        # State per series:
        # on_hand: int
        # pipeline_orders: list of dicts {"arrival_date": str, "qty": int}
        # batches: list of dicts {"qty": int, "expiry_date": str}
        # sales_history: list of float
        state = {}
        for item in series_keys:
            s_key = (item["store_id"], item["product_id"])
            # Initial inventory: ~2.5 days of average demand
            init_stock = 60
            state[s_key] = {
                "on_hand": init_stock,
                "pipeline_orders": [],
                "batches": [{"qty": init_stock, "expiry_idx": self.default_shelf_life_days}],
                "sales_history": [25.0] * 7,
                "category": item["category"]
            }

        for day_idx, current_date in enumerate(unique_dates):
            day_demand_total = 0.0
            day_fulfilled_total = 0.0
            day_lost_sales_total = 0.0
            day_orders_placed = 0
            day_orders_received = 0
            day_expired_units = 0
            day_on_hand_end = 0

            # Filter ground-truth demand rows for today
            day_records = df_demand[df_demand["date"] == current_date]
            demand_by_series = {
                (r["store_id"], r["product_id"]): float(r[target_col])
                for _, r in day_records.iterrows()
            }

            for item in series_keys:
                s_key = (item["store_id"], item["product_id"])
                s_state = state[s_key]

                # Step 1: Inbound arrivals (orders that mature today)
                arrived_qty = 0
                remaining_pipeline = []
                for order in s_state["pipeline_orders"]:
                    if order["arrival_idx"] <= day_idx:
                        arrived_qty += order["qty"]
                    else:
                        remaining_pipeline.append(order)
                s_state["pipeline_orders"] = remaining_pipeline

                if arrived_qty > 0:
                    s_state["on_hand"] += arrived_qty
                    day_orders_received += arrived_qty
                    if self.track_perishability:
                        shelf_days = 4 if item["category"] in ["Dairy", "Bakery", "Produce"] else self.default_shelf_life_days
                        s_state["batches"].append({"qty": arrived_qty, "expiry_idx": day_idx + shelf_days})

                # Step 2: Perishability expiration check
                if self.track_perishability:
                    valid_batches = []
                    for b in s_state["batches"]:
                        if b["expiry_idx"] <= day_idx:
                            # Expired
                            day_expired_units += b["qty"]
                            s_state["on_hand"] = max(0, s_state["on_hand"] - b["qty"])
                        else:
                            valid_batches.append(b)
                    s_state["batches"] = valid_batches

                # Step 3: Customer demand realization
                demand = demand_by_series.get(s_key, 20.0)
                day_demand_total += demand

                # Step 4: Fulfillment (bounded by available on-hand stock)
                available = s_state["on_hand"]
                fulfilled = min(available, demand)
                lost_sales = demand - fulfilled

                day_fulfilled_total += fulfilled
                day_lost_sales_total += lost_sales

                s_state["on_hand"] = max(0, available - fulfilled)
                day_on_hand_end += s_state["on_hand"]

                # FIFO consumption from batches
                if self.track_perishability and fulfilled > 0:
                    remaining_to_deduct = fulfilled
                    for b in s_state["batches"]:
                        deduct = min(b["qty"], remaining_to_deduct)
                        b["qty"] -= deduct
                        remaining_to_deduct -= deduct
                        if remaining_to_deduct <= 0:
                            break
                    s_state["batches"] = [b for b in s_state["batches"] if b["qty"] > 0]

                # Update sales history
                s_state["sales_history"].append(fulfilled)

                # Step 5: Replenishment review & order placement
                # Only on review days
                if day_idx % self.review_period_days == 0:
                    order_qty = 0
                    on_order = sum(o["qty"] for o in s_state["pipeline_orders"])
                    inv_pos = s_state["on_hand"] + on_order

                    if policy_type == "fixed_reorder_point":
                        # (s, Q): if inv_pos <= 40, order 50
                        reorder_point = 45
                        fixed_q = 55
                        if inv_pos <= reorder_point:
                            order_qty = fixed_q

                    elif policy_type == "moving_average_order_up_to":
                        # Trailing 7-day average sales
                        trailing_mean = np.mean(s_state["sales_history"][-7:])
                        protection_days = self.lead_time_days + self.review_period_days
                        target_stock = math.ceil(trailing_mean * protection_days * 1.3)
                        order_qty = max(0, target_stock - inv_pos)

                    elif policy_type == "ml_driven_replenishment":
                        # Use ML forecast + dynamic safety stock
                        protection_days = self.lead_time_days + self.review_period_days
                        # Lookup forecast for next protection_days
                        forecast_sum = 0.0
                        for step in range(1, protection_days + 1):
                            if day_idx + step < len(unique_dates):
                                f_date = unique_dates[day_idx + step]
                                f_val = forecast_map.get((item["store_id"], item["product_id"], f_date), np.mean(s_state["sales_history"][-7:]))
                                forecast_sum += f_val
                            else:
                                forecast_sum += np.mean(s_state["sales_history"][-7:])

                        # Dynamic safety stock based on forecast variance
                        safety_stock = math.ceil(1.645 * math.sqrt(protection_days) * 5.0)
                        target_stock = math.ceil(forecast_sum + safety_stock)
                        order_qty = max(0, target_stock - inv_pos)

                    if order_qty > 0:
                        s_state["pipeline_orders"].append({
                            "arrival_idx": day_idx + self.lead_time_days,
                            "qty": int(order_qty)
                        })
                        day_orders_placed += int(order_qty)
                        total_ordering_cost += self.order_placement_cost

            # Calculate daily costs
            day_holding_cost = day_on_hand_end * self.holding_cost_rate
            day_shortage_cost = day_lost_sales_total * self.shortage_penalty_rate
            day_waste_cost = day_expired_units * 35.0 # Average item cost
            day_total_cost = day_holding_cost + day_shortage_cost + day_waste_cost

            total_requested += day_demand_total
            total_fulfilled += day_fulfilled_total
            total_lost_sales += day_lost_sales_total
            total_holding_cost += day_holding_cost
            total_shortage_cost += day_shortage_cost
            total_waste_cost += day_waste_cost
            total_expired_units += day_expired_units
            daily_on_hand_sum += day_on_hand_end

            if day_lost_sales_total > 0:
                stockout_days_count += 1

            daily_ledger.append({
                "date": current_date,
                "demand": round(day_demand_total, 1),
                "fulfilled": round(day_fulfilled_total, 1),
                "lostSales": round(day_lost_sales_total, 1),
                "onHandEnd": round(day_on_hand_end, 1),
                "ordersPlaced": day_orders_placed,
                "ordersReceived": day_orders_received,
                "expiredUnits": day_expired_units,
                "dailyCost": round(day_total_cost, 2)
            })

        total_simulated_cost = total_holding_cost + total_shortage_cost + total_ordering_cost + total_waste_cost
        fill_rate = round((total_fulfilled / (total_requested + 1e-6)) * 100.0, 2)
        avg_inv = round(daily_on_hand_sum / max(1, len(unique_dates)), 1)

        return {
            "policyType": policy_type,
            "unitsRequested": round(total_requested, 1),
            "unitsFulfilled": round(total_fulfilled, 1),
            "fillRate": fill_rate,
            "stockoutDays": stockout_days_count,
            "unmetDemandUnits": round(total_lost_sales, 1),
            "averageInventory": avg_inv,
            "totalHoldingCost": round(total_holding_cost, 2),
            "totalShortageCost": round(total_shortage_cost, 2),
            "totalOrderingCost": round(total_ordering_cost, 2),
            "totalWasteCost": round(total_waste_cost, 2),
            "expiredUnits": int(total_expired_units),
            "totalSimulatedCost": round(total_simulated_cost, 2),
            "dailyLedger": daily_ledger
        }
