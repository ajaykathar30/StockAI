import pytest
from pipelines.inventory import calculate_recommendations

def test_zero_raw_order_stays_zero_despite_moq():
    """
    CRITICAL REQUIREMENT:
    'An initial quantity of zero must not become a positive order merely because an MOQ exists.'
    """
    params = [{
        "store_id": "STORE_1",
        "product_id": "PROD_1",
        "category": "Dairy",
        "lead_time_days": 2,
        "review_period_days": 1,
        "target_service_level": 0.95,
        "usable_on_hand": 100, # Ample inventory on hand
        "confirmed_on_order": 50,
        "committed_stock": 0,
        "case_pack_size": 12,
        "min_order_qty": 50, # High MOQ
        "unit_cost": 25.0
    }]

    # Low forecast where target_stock < inventory_position (150)
    forecasts = {
        "STORE_1::PROD_1": [{"predicted_mean": 10.0}] * 7
    }

    result = calculate_recommendations(params_list=params, forecasts_by_series=forecasts)
    rec = result["items"][0]

    assert rec["raw_suggested_order"] == 0
    # Rounded order must remain 0 despite MOQ being 50!
    assert rec["rounded_order_qty"] == 0
    assert rec["total_order_cost"] == 0.0

def test_pack_rounding_and_moq_enforcement_when_positive():
    """
    When raw order > 0, it should round up to the nearest multiple of case_pack_size,
    and then satisfy MOQ.
    """
    params = [{
        "store_id": "STORE_1",
        "product_id": "PROD_1",
        "category": "Snacks",
        "lead_time_days": 1,
        "review_period_days": 1,
        "usable_on_hand": 5,
        "confirmed_on_order": 0,
        "committed_stock": 0,
        "case_pack_size": 6,
        "min_order_qty": 20,
        "unit_cost": 10.0
    }]

    # Forecast of 15 per day, protection period = 2 days -> 30 units forecast + safety stock ~10 = target ~40
    # inventory_pos = 5 -> raw_order = 35
    forecasts = {
        "STORE_1::PROD_1": [{"predicted_mean": 15.0}] * 7
    }

    result = calculate_recommendations(params_list=params, forecasts_by_series=forecasts)
    rec = result["items"][0]

    assert rec["raw_suggested_order"] > 0
    # Must be multiple of case_pack (6) and >= MOQ (20)
    assert rec["rounded_order_qty"] % 6 == 0
    assert rec["rounded_order_qty"] >= 20

def test_perishable_shelf_life_limit():
    """
    Shelf-life limits must depend on expected sales before expiry,
    preventing over-ordering that would lead to spoilage.
    """
    params = [{
        "store_id": "STORE_1",
        "product_id": "MILK_FRESH",
        "category": "Dairy",
        "lead_time_days": 1,
        "review_period_days": 1,
        "usable_on_hand": 20,
        "confirmed_on_order": 0,
        "committed_stock": 0,
        "case_pack_size": 1,
        "min_order_qty": 0,
        "unit_cost": 50.0,
        "shelf_life_days": 2 # Very short shelf life (2 days)
    }]

    # Daily forecast is 10 units. Over 2 days, maximum consumption is 20 units.
    # Current on_hand is already 20, so maximum absorbable new order is 0!
    forecasts = {
        "STORE_1::MILK_FRESH": [{"predicted_mean": 10.0}] * 7
    }

    result = calculate_recommendations(params_list=params, forecasts_by_series=forecasts)
    rec = result["items"][0]

    # Should not suggest ordering more than can be absorbed before expiry
    assert rec["rounded_order_qty"] == 0
