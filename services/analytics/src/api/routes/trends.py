"""
Trends Analysis Routes for Analytics Service
Location: services/analytics/src/api/routes/trends.py
"""

import time
import json
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any
from decimal import Decimal
from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import pandas as pd
import numpy as np
from scipy import stats
import structlog

from ...config.database import execute_query, execute_fetchrow, cache_get, cache_set
from ...config.settings import settings
from ...models.schemas import (
    TrendsRequest, TrendsResponse, TimePeriodData, ChartData, InsightItem,
    ChartType, PeriodType, TrendDirection
)
from ...middleware.auth import get_user_id
from ...utils.logger import analytics_logger, performance_logger

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/spending", response_model=TrendsResponse, tags=["Trends"])
async def get_spending_trends(
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_seasonality: bool = True,
    smoothing: bool = False,
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    user_id: str = Depends(get_user_id)
):
    """
    Analyze spending trends over time
    
    Returns:
    - Trend direction and strength
    - Time series data with trend lines
    - Seasonal pattern analysis
    - Spending velocity indicators
    - Predictive trend projections
    """
    start_time = time.time()
    
    try:
        cache_key = f"spending_trends:{user_id}:{period}:{start_date}:{end_date}:{include_seasonality}:{smoothing}:{category_id}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return TrendsResponse(**response_data)
        
        # Calculate date range
        date_range = _calculate_trend_date_range(period, start_date, end_date)
        
        # Get time series data
        time_series_data = await _get_spending_time_series(user_id, date_range, period, category_id)
        
        # Perform trend analysis
        trend_analysis = _analyze_trend_direction(time_series_data, smoothing)
        
        # Seasonal analysis if requested
        seasonal_patterns = None
        if include_seasonality and len(time_series_data) >= 12:  # Need minimum data for seasonality
            seasonal_patterns = _analyze_seasonal_patterns(time_series_data, period)
        
        # Generate trend charts
        charts = await _generate_trend_charts(time_series_data, trend_analysis, seasonal_patterns, smoothing)
        
        # Generate predictions
        predictions = _generate_trend_predictions(time_series_data, trend_analysis, days_ahead=30)
        
        response_data = TrendsResponse(
            trend_direction=trend_analysis["direction"],
            trend_strength=trend_analysis["strength"],
            trend_percentage=trend_analysis["percentage_change"],
            seasonal_patterns=seasonal_patterns,
            time_series=time_series_data,
            charts=charts,
            predictions=predictions,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_DEFAULT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="spending_trends_analyzed",
            resource="trends",
            trend_direction=trend_analysis["direction"],
            data_points=len(time_series_data)
        )
        
        return response_data
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        analytics_logger.log_error_with_context(e, {
            "user_id": user_id,
            "period": period,
            "processing_time_ms": processing_time
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze spending trends: {str(e)}"
        )

@router.get("/category/{category_id}", response_model=TrendsResponse, tags=["Trends"])
async def get_category_trends(
    category_id: str,
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_seasonality: bool = True,
    compare_to_average: bool = True,
    user_id: str = Depends(get_user_id)
):
    """
    Analyze trends for a specific category
    
    Returns:
    - Category-specific trend analysis
    - Comparison to user's average spending
    - Category performance metrics
    - Seasonal spending patterns for category
    - Category-specific insights and recommendations
    """
    start_time = time.time()
    
    try:
        cache_key = f"category_trends:{user_id}:{category_id}:{period}:{start_date}:{end_date}:{include_seasonality}:{compare_to_average}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return TrendsResponse(**response_data)
        
        # Validate category belongs to user
        await _validate_user_category(user_id, category_id)
        
        # Calculate date range
        date_range = _calculate_trend_date_range(period, start_date, end_date)
        
        # Get category-specific time series
        time_series_data = await _get_category_time_series(user_id, category_id, date_range, period)
        
        # Perform trend analysis
        trend_analysis = _analyze_trend_direction(time_series_data)
        
        # Category comparison analysis
        comparison_data = None
        if compare_to_average:
            comparison_data = await _get_category_comparison(user_id, category_id, date_range, period)
        
        # Seasonal analysis
        seasonal_patterns = None
        if include_seasonality and len(time_series_data) >= 8:
            seasonal_patterns = _analyze_seasonal_patterns(time_series_data, period)
        
        # Generate charts
        charts = await _generate_category_trend_charts(time_series_data, trend_analysis, comparison_data, seasonal_patterns)
        
        # Generate category-specific insights
        insights = await _generate_category_trend_insights(user_id, category_id, trend_analysis, comparison_data)
        
        response_data = TrendsResponse(
            trend_direction=trend_analysis["direction"],
            trend_strength=trend_analysis["strength"],
            trend_percentage=trend_analysis["percentage_change"],
            seasonal_patterns=seasonal_patterns,
            time_series=time_series_data,
            charts=charts,
            predictions=comparison_data,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_DEFAULT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="category_trends_analyzed",
            resource=f"category:{category_id}",
            trend_direction=trend_analysis["direction"]
        )
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        analytics_logger.log_error_with_context(e, {
            "user_id": user_id,
            "category_id": category_id,
            "processing_time_ms": processing_time
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze category trends: {str(e)}"
        )

@router.get("/comparative", tags=["Trends"])
async def get_comparative_trends(
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs to compare"),
    metric: str = Query("amount", description="Metric to compare: amount, count, average"),
    normalize: bool = Query(False, description="Normalize values for comparison"),
    user_id: str = Depends(get_user_id)
):
    """
    Compare trends across multiple categories or time periods
    
    Returns:
    - Side-by-side trend comparisons
    - Relative performance analysis
    - Growth rate comparisons
    - Correlation analysis between categories
    - Comparative insights and recommendations
    """
    start_time = time.time()
    
    try:
        # Parse category IDs
        category_id_list = []
        if category_ids:
            category_id_list = [id.strip() for id in category_ids.split(",")]
        
        cache_key = f"comparative_trends:{user_id}:{period}:{start_date}:{end_date}:{category_ids}:{metric}:{normalize}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            return json.loads(cached_data)
        
        # Calculate date range
        date_range = _calculate_trend_date_range(period, start_date, end_date)
        
        # Get comparative data
        comparative_data = await _get_comparative_trend_data(user_id, date_range, period, category_id_list, metric)
        
        # Perform comparative analysis
        comparison_analysis = _analyze_comparative_trends(comparative_data, normalize)
        
        # Generate comparative charts
        charts = _generate_comparative_charts(comparative_data, comparison_analysis, normalize)
        
        # Generate correlation analysis
        correlation_analysis = _analyze_trend_correlations(comparative_data)
        
        # Generate comparative insights
        insights = _generate_comparative_insights(comparison_analysis, correlation_analysis)
        
        response_data = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "comparative_analysis": comparison_analysis,
            "correlation_analysis": correlation_analysis,
            "charts": [chart.dict() for chart in charts],
            "insights": [insight.dict() for insight in insights],
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Cache result
        await cache_set(cache_key, json.dumps(response_data, default=str), ttl=settings.CACHE_TTL_DEFAULT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="comparative_trends_analyzed",
            resource="comparative_trends",
            categories_compared=len(category_id_list)
        )
        
        return response_data
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        analytics_logger.log_error_with_context(e, {
            "user_id": user_id,
            "processing_time_ms": processing_time
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate comparative trends: {str(e)}"
        )

@router.get("/velocity", tags=["Trends"])
async def get_spending_velocity(
    request: Request,
    period: PeriodType = PeriodType.weekly,
    lookback_days: int = Query(90, ge=30, le=365, description="Days to look back for velocity calculation"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    user_id: str = Depends(get_user_id)
):
    """
    Analyze spending velocity (acceleration/deceleration)
    
    Returns:
    - Spending acceleration/deceleration metrics
    - Velocity trend charts
    - Rate of change analysis
    - Momentum indicators
    - Velocity-based insights
    """
    start_time = time.time()
    
    try:
        cache_key = f"spending_velocity:{user_id}:{period}:{lookback_days}:{category_id}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            return json.loads(cached_data)
        
        # Calculate date range for velocity analysis
        end_date = date.today()
        start_date = end_date - timedelta(days=lookback_days)
        date_range = {"start": start_date, "end": end_date}
        
        # Get velocity data
        velocity_data = await _calculate_spending_velocity(user_id, date_range, period, category_id)
        
        # Generate velocity charts
        velocity_charts = _generate_velocity_charts(velocity_data)
        
        # Generate velocity insights
        velocity_insights = _generate_velocity_insights(velocity_data)
        
        response_data = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "velocity_analysis": velocity_data,
            "charts": [chart.dict() for chart in velocity_charts],
            "insights": [insight.dict() for insight in velocity_insights],
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Cache result
        await cache_set(cache_key, json.dumps(response_data, default=str), ttl=settings.CACHE_TTL_SHORT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="spending_velocity_analyzed",
            resource="velocity",
            lookback_days=lookback_days
        )
        
        return response_data
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        analytics_logger.log_error_with_context(e, {
            "user_id": user_id,
            "processing_time_ms": processing_time
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze spending velocity: {str(e)}"
        )

# Utility functions
def _calculate_trend_date_range(period: PeriodType, start_date: Optional[date], end_date: Optional[date]) -> dict:
    """Calculate appropriate date range for trend analysis"""
    if start_date and end_date:
        return {"start": start_date, "end": end_date}
    
    today = date.today()
    
    # Longer lookback periods for trend analysis
    if period == PeriodType.daily:
        return {"start": today - timedelta(days=90), "end": today}
    elif period == PeriodType.weekly:
        return {"start": today - timedelta(weeks=52), "end": today}  # 1 year
    elif period == PeriodType.monthly:
        return {"start": today - timedelta(days=365 * 2), "end": today}  # 2 years
    elif period == PeriodType.quarterly:
        return {"start": today - timedelta(days=365 * 3), "end": today}  # 3 years
    elif period == PeriodType.yearly:
        return {"start": today - timedelta(days=365 * 5), "end": today}  # 5 years
    
    return {"start": today - timedelta(days=365), "end": today}

async def _get_spending_time_series(user_id: str, date_range: dict, period: PeriodType, category_id: Optional[str]) -> List[TimePeriodData]:
    """Get spending time series data"""
    # Use the database function for trend analysis
    query = "SELECT * FROM get_spending_trend($1, $2)"
    days = (date_range["end"] - date_range["start"]).days
    
    results = await execute_query(query, user_id, days)
    
    time_series = []
    for row in results:
        time_series.append(TimePeriodData(
            period=row["period_date"].isoformat(),
            amount=Decimal(str(row["total_amount"])),
            transaction_count=row["transaction_count"]
        ))
    
    return time_series

def _analyze_trend_direction(time_series_data: List[TimePeriodData], smoothing: bool = False) -> dict:
    """Analyze trend direction using statistical methods"""
    if len(time_series_data) < 2:
        return {
            "direction": TrendDirection.stable,
            "strength": 0.0,
            "percentage_change": 0.0
        }
    
    # Extract amounts for analysis
    amounts = [float(data.amount) for data in time_series_data]
    
    if smoothing:
        # Apply simple moving average smoothing
        window_size = min(3, len(amounts) // 3)
        amounts = pd.Series(amounts).rolling(window=window_size, center=True).mean().fillna(method='bfill').fillna(method='ffill').tolist()
    
    # Calculate linear regression slope
    x = np.arange(len(amounts))
    slope, intercept, r_value, p_value, std_err = stats.linregress(x, amounts)
    
    # Determine trend direction
    if slope > 0.1:
        direction = TrendDirection.increasing
    elif slope < -0.1:
        direction = TrendDirection.decreasing
    else:
        direction = TrendDirection.stable
    
    # Calculate trend strength (R-squared)
    strength = r_value ** 2
    
    # Calculate percentage change
    if len(amounts) >= 2:
        first_amount = amounts[0]
        last_amount = amounts[-1]
        percentage_change = ((last_amount - first_amount) / first_amount * 100) if first_amount != 0 else 0
    else:
        percentage_change = 0
    
    return {
        "direction": direction,
        "strength": min(1.0, abs(strength)),
        "percentage_change": round(percentage_change, 2),
        "slope": slope,
        "r_squared": strength,
        "p_value": p_value
    }

def _analyze_seasonal_patterns(time_series_data: List[TimePeriodData], period: PeriodType) -> dict:
    """Analyze seasonal patterns in spending data"""
    if len(time_series_data) < 12:
        return None
    
    # Convert to pandas for easier seasonal analysis
    dates = [datetime.fromisoformat(data.period) for data in time_series_data]
    amounts = [float(data.amount) for data in time_series_data]
    
    df = pd.DataFrame({"date": dates, "amount": amounts})
    df["month"] = df["date"].dt.month
    df["quarter"] = df["date"].dt.quarter
    df["day_of_week"] = df["date"].dt.dayofweek
    
    # Monthly seasonality
    monthly_avg = df.groupby("month")["amount"].mean().to_dict()
    
    # Find peak and low months
    peak_month = max(monthly_avg, key=monthly_avg.get)
    low_month = min(monthly_avg, key=monthly_avg.get)
    
    # Calculate seasonality strength
    seasonal_variance = np.var(list(monthly_avg.values()))
    overall_variance = np.var(amounts)
    seasonality_strength = seasonal_variance / overall_variance if overall_variance > 0 else 0
    
    return {
        "has_seasonality": seasonality_strength > 0.1,
        "seasonality_strength": min(1.0, seasonality_strength),
        "monthly_patterns": monthly_avg,
        "peak_month": peak_month,
        "low_month": low_month,
        "seasonal_variance": seasonal_variance
    }

async def _generate_trend_charts(time_series_data: List[TimePeriodData], trend_analysis: dict, 
                                seasonal_patterns: dict, smoothing: bool) -> List[ChartData]:
    """Generate trend visualization charts"""
    charts = []
    
    # Main trend line chart
    trend_chart_data = [
        {
            "period": data.period,
            "amount": float(data.amount),
            "transaction_count": data.transaction_count
        }
        for data in time_series_data
    ]
    
    trend_chart = ChartData(
        chart_type=ChartType.line,
        title="Spending Trend Analysis",
        data=trend_chart_data,
        config={
            "trend_line": True,
            "smoothing": smoothing,
            "show_trend_stats": True,
            "colors": ["#3b82f6", "#ef4444"]
        }
    )
    charts.append(trend_chart)
    
    # Seasonal pattern chart if available
    if seasonal_patterns and seasonal_patterns.get("has_seasonality"):
        seasonal_data = [
            {"month": month, "average_amount": amount}
            for month, amount in seasonal_patterns["monthly_patterns"].items()
        ]
        
        seasonal_chart = ChartData(
            chart_type=ChartType.bar,
            title="Monthly Spending Patterns",
            data=seasonal_data,
            config={"highlight_peaks": True}
        )
        charts.append(seasonal_chart)
    
    return charts

def _generate_trend_predictions(time_series_data: List[TimePeriodData], trend_analysis: dict, days_ahead: int) -> dict:
    """Generate simple trend predictions"""
    if len(time_series_data) < 3:
        return None
    
    # Simple linear prediction based on trend slope
    slope = trend_analysis.get("slope", 0)
    last_amount = float(time_series_data[-1].amount)
    
    # Project future values
    predictions = []
    for i in range(1, days_ahead + 1):
        predicted_amount = last_amount + (slope * i)
        predictions.append({
            "days_ahead": i,
            "predicted_amount": max(0, predicted_amount),  # Don't predict negative spending
            "confidence": max(0, trend_analysis.get("r_squared", 0))
        })
    
    return {
        "prediction_method": "linear_trend",
        "predictions": predictions[:10],  # Return first 10 days
        "trend_confidence": trend_analysis.get("r_squared", 0)
    }

async def _validate_user_category(user_id: str, category_id: str):
    """Validate that category belongs to user"""
    query = "SELECT COUNT(*) FROM categories WHERE id = $1 AND user_id = $2"
    count = await execute_query(query, category_id, user_id)
    
    if not count or count[0]["count"] == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or does not belong to user"
        )

async def _get_category_time_series(user_id: str, category_id: str, date_range: dict, period: PeriodType) -> List[TimePeriodData]:
    """Get time series data for specific category"""
    # Implementation would query expenses filtered by category
    return []

async def _get_category_comparison(user_id: str, category_id: str, date_range: dict, period: PeriodType) -> dict:
    """Get category comparison data"""
    return {}

async def _generate_category_trend_charts(time_series_data: List[TimePeriodData], trend_analysis: dict, 
                                        comparison_data: dict, seasonal_patterns: dict) -> List[ChartData]:
    """Generate category-specific trend charts"""
    return []

async def _generate_category_trend_insights(user_id: str, category_id: str, trend_analysis: dict, comparison_data: dict) -> List[InsightItem]:
    """Generate category-specific insights"""
    return []

async def _get_comparative_trend_data(user_id: str, date_range: dict, period: PeriodType, 
                                    category_ids: List[str], metric: str) -> dict:
    """Get data for comparative analysis"""
    return {}

def _analyze_comparative_trends(comparative_data: dict, normalize: bool) -> dict:
    """Analyze comparative trends"""
    return {}

def _generate_comparative_charts(comparative_data: dict, comparison_analysis: dict, normalize: bool) -> List[ChartData]:
    """Generate comparative charts"""
    return []

def _analyze_trend_correlations(comparative_data: dict) -> dict:
    """Analyze correlations between trends"""
    return {}

def _generate_comparative_insights(comparison_analysis: dict, correlation_analysis: dict) -> List[InsightItem]:
    """Generate comparative insights"""
    return []

async def _calculate_spending_velocity(user_id: str, date_range: dict, period: PeriodType, category_id: Optional[str]) -> dict:
    """Calculate spending velocity metrics"""
    return {}

def _generate_velocity_charts(velocity_data: dict) -> List[ChartData]:
    """Generate velocity charts"""
    return []

def _generate_velocity_insights(velocity_data: dict) -> List[InsightItem]:
    """Generate velocity insights"""
    return []