"""
QuickStock AI - Inventory Replenishment & Decision Engine
Implements auditable periodic-review (R, S) order-up-to policies with
safety stock calibration, case-pack/MOQ rounding, perishability, and capacity constraints.
"""

import math
from typing import List, Dict, Any, Optional

def get_z_factor(service_level: float) -> float:
    """Standard normal quantile approximation for service level."""
    if service_level >= 0.99:
        return 2.33
    elif service_level >= 0.98:
        return 2.05
    elif service_level >= 0.95:
        return 1.645
    elif service_level >= 0.90:
        return 1.28
    elif service_level >= 0.85:
        return 1.04
    else:
        return 0.84

def calculate_recommendations(
    params_list: List[Dict[str, Any]],
    forecasts_by_series: Dict[str, List[Dict[str, Any]]],
    sigma_daily_by_series: Optional[Dict[str, float]] = None,
    warehouse_capacity_limit: Optional[int] = None,
    procurement_budget_limit: Optional[float] = None
) -> Dict[str, Any]:
    """
    Computes auditable replenishment recommendations for all store-product series.
    """
    recommendations = []
    total_raw_units = 0
    total_order_cost = 0.0

    for p in params_list:
        s_id = str(p["store_id"])
        p_id = str(p["product_id"])
        category = str(p.get("category", "General"))

        lead_time = max(1, int(p.get("lead_time_days", 2)))
        review_period = max(1, int(p.get("review_period_days", 1)))
        protection_period = lead_time + review_period # L + R

        service_level = float(p.get("target_service_level", 0.95))
        usable_on_hand = max(0, int(p.get("usable_on_hand", 0)))
        confirmed_on_order = max(0, int(p.get("confirmed_on_order", 0)))
        committed_stock = max(0, int(p.get("committed_stock", 0)))

        case_pack = max(1, int(p.get("case_pack_size", 1)))
        moq = max(0, int(p.get("min_order_qty", 0)))
        unit_cost = max(0.01, float(p.get("unit_cost", 50.0)))
        shelf_life = p.get("shelf_life_days")

        # Get protection period forecast
        series_key = f"{s_id}::{p_id}"
        series_forecasts = forecasts_by_series.get(series_key, [])

        if series_forecasts:
            # Sum up to protection_period days
            relevant_days = series_forecasts[:protection_period]
            prot_forecast = sum(pt.get("predicted_mean", 0.0) for pt in relevant_days)
            # If horizon < protection_period, extrapolate daily rate
            if len(relevant_days) < protection_period and len(relevant_days) > 0:
                daily_rate = prot_forecast / len(relevant_days)
                prot_forecast += daily_rate * (protection_period - len(relevant_days))
        else:
            # Fallback baseline demand
            prot_forecast = 25.0 * protection_period

        prot_forecast = round(prot_forecast, 1)

        # Safety Stock calculation
        # sigma_protection = sqrt(L + R) * sigma_daily
        sigma_daily = 6.0
        if sigma_daily_by_series and series_key in sigma_daily_by_series:
            sigma_daily = sigma_daily_by_series[series_key]

        z = get_z_factor(service_level)
        sigma_protection = math.sqrt(protection_period) * sigma_daily
        safety_stock = int(math.ceil(z * sigma_protection))

        # Target stock level S
        target_stock = int(math.ceil(prot_forecast + safety_stock))

        # Inventory position
        inventory_position = usable_on_hand + confirmed_on_order - committed_stock

        # Raw replenishment needed
        raw_suggested = max(0, target_stock - inventory_position)

        # Perishability constraint check
        expiry_risk_units = 0
        if shelf_life is not None and shelf_life > 0:
            # Expected consumption during remaining shelf life
            shelf_life_days = int(shelf_life)
            daily_demand = prot_forecast / max(1, protection_period)
            max_absorbable_demand = daily_demand * shelf_life_days
            max_order_perishable = max(0, int(max_absorbable_demand - usable_on_hand))
            if raw_suggested > max_order_perishable:
                expiry_risk_units = raw_suggested - max_order_perishable
                raw_suggested = max_order_perishable

        # Pack rounding and MOQ rule
        # CRITICAL RULE: If raw suggested is 0, order remains 0. An MOQ never forces an order on zero need!
        final_order = 0
        if raw_suggested > 0:
            # Round up to multiple of case_pack
            packs_needed = math.ceil(raw_suggested / case_pack)
            pack_rounded = packs_needed * case_pack
            # Apply MOQ
            final_order = max(pack_rounded, moq)

        item_order_cost = round(final_order * unit_cost, 2)
        total_raw_units += final_order
        total_order_cost += item_order_cost

        # Determine priority tier
        if inventory_position <= (safety_stock * 0.4) or usable_on_hand == 0:
            priority = "Critical"
        elif inventory_position < (target_stock * 0.8):
            priority = "Reorder soon"
        elif inventory_position <= (target_stock * 1.5):
            priority = "Healthy"
        else:
            priority = "Excess inventory"

        explanation = (
            f"Protection-period ({protection_period}d) forecast: {prot_forecast} units; "
            f"Safety stock: {safety_stock}; Inventory position: {inventory_position}; "
            f"Raw order: {raw_suggested}; Final pack/MOQ order: {final_order}."
        )

        recommendations.append({
            "id": f"rec_{s_id}_{p_id}",
            "store_id": s_id,
            "product_id": p_id,
            "category": category,
            "priority": priority,
            "protection_period_days": protection_period,
            "protection_period_forecast": prot_forecast,
            "safety_stock": safety_stock,
            "target_stock": target_stock,
            "inventory_position": inventory_position,
            "raw_suggested_order": raw_suggested,
            "rounded_order_qty": final_order,
            "unit_cost": unit_cost,
            "total_order_cost": item_order_cost,
            "service_level_achieved": service_level,
            "expiry_risk_units": expiry_risk_units,
            "is_budget_constrained": False,
            "is_capacity_constrained": False,
            "explanation": explanation,
            "audit_formula": {
                "formula": "rounded_order = MOQ_and_pack_round(max(0, (forecast_L_plus_R + z * sigma_L_plus_R) - (on_hand + on_order - committed)))",
                "values": {
                    "lead_time": lead_time,
                    "review_period": review_period,
                    "protection_period": protection_period,
                    "forecast_L_plus_R": prot_forecast,
                    "z_score": z,
                    "safety_stock": safety_stock,
                    "usable_on_hand": usable_on_hand,
                    "confirmed_on_order": confirmed_on_order,
                    "committed_stock": committed_stock,
                    "inventory_position": inventory_position,
                    "case_pack": case_pack,
                    "moq": moq,
                    "raw_order": raw_suggested,
                    "final_order": final_order
                }
            }
        })

    # Apply capacity or budget scaling if limits are exceeded
    capacity_warning = None
    budget_warning = None

    if warehouse_capacity_limit and total_raw_units > warehouse_capacity_limit:
        scale = warehouse_capacity_limit / total_raw_units
        capacity_warning = f"Warehouse capacity of {warehouse_capacity_limit} units exceeded ({total_raw_units} requested). Scaled by {round(scale*100, 1)}%."
        for item in recommendations:
            if item["rounded_order_qty"] > 0:
                item["is_capacity_constrained"] = True
                item["rounded_order_qty"] = int(math.floor(item["rounded_order_qty"] * scale))
                item["total_order_cost"] = round(item["rounded_order_qty"] * item["unit_cost"], 2)

    if procurement_budget_limit and total_order_cost > procurement_budget_limit:
        scale = procurement_budget_limit / total_order_cost
        budget_warning = f"Budget of ₹{procurement_budget_limit:,.2f} exceeded (₹{total_order_cost:,.2f} requested). Scaled by {round(scale*100, 1)}%."
        for item in recommendations:
            if item["rounded_order_qty"] > 0:
                item["is_budget_constrained"] = True
                item["rounded_order_qty"] = int(math.floor(item["rounded_order_qty"] * scale))
                item["total_order_cost"] = round(item["rounded_order_qty"] * item["unit_cost"], 2)

    # Sort critical items first, then by priority
    priority_order = {"Critical": 0, "Reorder soon": 1, "Healthy": 2, "Excess inventory": 3}
    recommendations.sort(key=lambda x: (priority_order.get(x["priority"], 9), -x["rounded_order_qty"]))

    final_total_units = sum(i["rounded_order_qty"] for i in recommendations)
    final_total_cost = sum(i["total_order_cost"] for i in recommendations)

    return {
        "items": recommendations,
        "summary": {
            "totalUnits": final_total_units,
            "totalCost": round(final_total_cost, 2),
            "criticalCount": sum(1 for i in recommendations if i["priority"] == "Critical"),
            "reorderSoonCount": sum(1 for i in recommendations if i["priority"] == "Reorder soon"),
            "healthyCount": sum(1 for i in recommendations if i["priority"] == "Healthy"),
            "excessCount": sum(1 for i in recommendations if i["priority"] == "Excess inventory"),
            "capacityWarning": capacity_warning,
            "budgetWarning": budget_warning
        }
    }
