"""
Simplified Trends Routes - REAL DATA ONLY with FIXED Date Ordering
Location: services/analytics/src/api/routes/trends.py
"""

import time
from datetime import date, datetime, timedelta
from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import structlog

from ...config.database import execute_query
from ...middleware.auth import get_user_id

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/spending", tags=["Trends"])
async def get_spending_trends(
    request: Request,
    period: str = Query("monthly", description="Period: daily, weekly, monthly"),
    user_id: str = Depends(get_user_id)
):
    """
    Simple spending trends - Real data only, no complex analysis
    """
    start_time = time.time()
    
    try:
        # Get simple spending trend data
        trend_data = await get_simple_spending_trend(user_id, period)
        
        # Calculate simple trend direction
        trend_direction = calculate_simple_trend(trend_data)
        
        response_data = {
            "success": True,
            "trend_direction": trend_direction["direction"],
            "trend_strength": trend_direction["strength"],
            "trend_percentage": trend_direction["percentage_change"],
            "time_series": trend_data,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except Exception as e:
        logger.error("Spending trends failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze spending trends: {str(e)}"
        )

# SIMPLE HELPER FUNCTIONS - FIXED CHRONOLOGICAL ORDER

async def get_simple_spending_trend(user_id: str, period: str) -> List[dict]:
    """Get simple spending trend from database - FIXED CHRONOLOGICAL ORDER"""
    
    # Determine date truncation and range
    if period == "daily":
        date_trunc = "day"
        days_back = 30
    elif period == "weekly":
        date_trunc = "week"
        days_back = 84  # 12 weeks
    else:  # monthly
        date_trunc = "month"
        days_back = 365  # 12 months
    
    query = f"""
    SELECT 
        DATE_TRUNC('{date_trunc}', e.transaction_date) as period,
        SUM(e.amount) as total_amount,
        COUNT(e.id) as transaction_count
    FROM expenses e
    WHERE e.user_id = $1
        AND e.transaction_date >= CURRENT_DATE - INTERVAL '{days_back} days'
    GROUP BY DATE_TRUNC('{date_trunc}', e.transaction_date)
    ORDER BY period ASC
    """
    
    results = await execute_query(query, user_id)
    
    return [
        {
            "period": row["period"].strftime("%Y-%m-%d"),
            "amount": float(row["total_amount"]),
            "transaction_count": row["transaction_count"]
        }
        for row in results
    ]

def calculate_simple_trend(trend_data: List[dict]) -> dict:
    """Calculate simple trend direction from data"""
    if len(trend_data) < 2:
        return {
            "direction": "stable",
            "strength": 0.0,
            "percentage_change": 0.0
        }
    
    # Compare first half to second half
    mid_point = len(trend_data) // 2
    first_half_avg = sum(item["amount"] for item in trend_data[:mid_point]) / mid_point if mid_point > 0 else 0
    second_half_avg = sum(item["amount"] for item in trend_data[mid_point:]) / (len(trend_data) - mid_point)
    
    if first_half_avg == 0:
        percentage_change = 0
    else:
        percentage_change = ((second_half_avg - first_half_avg) / first_half_avg) * 100
    
    # Determine direction
    if abs(percentage_change) < 5:
        direction = "stable"
        strength = 0.0
    elif percentage_change > 0:
        direction = "increasing"
        strength = min(abs(percentage_change) / 50, 1.0)  # Normalize to 0-1
    else:
        direction = "decreasing"
        strength = min(abs(percentage_change) / 50, 1.0)
    
    return {
        "direction": direction,
        "strength": strength,
        "percentage_change": percentage_change
    }