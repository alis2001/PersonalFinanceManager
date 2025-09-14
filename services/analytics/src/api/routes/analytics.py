"""
Core Analytics Routes for Analytics Service
Location: services/analytics/src/api/routes/analytics.py
"""

import time
import json
from datetime import date, datetime, timedelta
from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import structlog

from ...config.database import execute_query, execute_fetchrow, execute_scalar, cache_get, cache_set
from ...config.settings import settings
from ...models.schemas import (
    AnalyticsOverviewRequest, AnalyticsOverviewResponse,
    CategoryAnalyticsRequest, CategoryAnalyticsResponse,
    BudgetAnalyticsRequest, BudgetAnalyticsResponse,
    CategorySummary, TimePeriodData, BudgetStatus, ChartData, InsightItem,
    ChartType, PeriodType, TrendDirection
)
from ...middleware.auth import get_user_id
from ...utils.logger import analytics_logger, performance_logger

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/overview", response_model=AnalyticsOverviewResponse, tags=["Analytics"])
async def get_analytics_overview(
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    include_forecasting: bool = False,
    include_comparisons: bool = True,
    user_id: str = Depends(get_user_id)
):
    """
    Get comprehensive analytics overview
    
    Returns:
    - Total expenses and income
    - Net amount and transaction counts  
    - Top categories
    - Period comparisons
    - Interactive charts
    - AI-generated insights
    """
    start_time = time.time()
    
    try:
        # Generate cache key
        cache_key = f"overview:{user_id}:{period}:{start_date}:{end_date}:{include_forecasting}:{include_comparisons}"
        
        # Try cache first
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return AnalyticsOverviewResponse(**response_data)
        
        # Calculate date range
        date_range = _calculate_date_range(period, start_date, end_date)
        
        # Get overview data concurrently
        overview_data = await _get_overview_data(user_id, date_range)
        top_categories = await _get_top_categories(user_id, date_range)
        charts = await _generate_overview_charts(user_id, date_range, overview_data, top_categories)
        insights = await _generate_overview_insights(overview_data, top_categories)
        
        # Period comparison if requested
        period_comparison = None
        if include_comparisons:
            period_comparison = await _get_period_comparison(user_id, date_range, period)
        
        # Build response
        response_data = AnalyticsOverviewResponse(
            total_expenses=overview_data["total_expenses"],
            total_income=overview_data["total_income"], 
            net_amount=overview_data["net_amount"],
            transaction_count=overview_data["transaction_count"],
            average_daily_spending=overview_data["average_daily_spending"],
            period_comparison=period_comparison,
            top_expense_categories=top_categories["expenses"],
            top_income_categories=top_categories["income"],
            charts=charts,
            insights=insights,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache the result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_SHORT)
        analytics_logger.log_cache_operation("set", cache_key, ttl=settings.CACHE_TTL_SHORT)
        
        # Log analytics
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="overview_generated",
            resource="analytics",
            period=period,
            date_range=f"{date_range['start']} to {date_range['end']}"
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
            detail=f"Failed to generate analytics overview: {str(e)}"
        )

@router.get("/categories", response_model=CategoryAnalyticsResponse, tags=["Analytics"])
async def get_category_analytics(
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    include_subcategories: bool = True,
    group_by_type: bool = True,
    user_id: str = Depends(get_user_id)
):
    """
    Get detailed category analytics
    
    Returns:
    - Category breakdown with amounts and percentages
    - Time series data for trends
    - Category comparison charts
    - Category-specific insights
    """
    start_time = time.time()
    
    try:
        # Parse category IDs if provided
        category_id_list = []
        if category_ids:
            category_id_list = [id.strip() for id in category_ids.split(",")]
        
        cache_key = f"categories:{user_id}:{period}:{start_date}:{end_date}:{category_ids}:{include_subcategories}:{group_by_type}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return CategoryAnalyticsResponse(**response_data)
        
        # Calculate date range
        date_range = _calculate_date_range(period, start_date, end_date)
        
        # Get category data
        categories = await _get_category_breakdown(user_id, date_range, category_id_list, group_by_type)
        time_series = await _get_category_time_series(user_id, date_range, category_id_list, period)
        charts = await _generate_category_charts(categories, time_series)
        insights = await _generate_category_insights(categories, time_series)
        
        response_data = CategoryAnalyticsResponse(
            categories=categories,
            time_series=time_series,
            charts=charts,
            insights=insights,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_DEFAULT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="category_analysis",
            resource="categories",
            category_count=len(categories),
            period=period
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
            detail=f"Failed to generate category analytics: {str(e)}"
        )

@router.get("/budget", response_model=BudgetAnalyticsResponse, tags=["Analytics"])
async def get_budget_analytics(
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    include_predictions: bool = False,
    alert_threshold: float = Query(0.8, ge=0.0, le=1.0, description="Budget alert threshold"),
    user_id: str = Depends(get_user_id)
):
    """
    Get budget analysis and performance
    
    Returns:
    - Budget vs actual spending by category
    - Budget utilization percentages
    - Over-budget alerts
    - Budget performance charts
    - Recommendations for budget optimization
    """
    start_time = time.time()
    
    try:
        # Parse category IDs if provided
        category_id_list = []
        if category_ids:
            category_id_list = [id.strip() for id in category_ids.split(",")]
        
        cache_key = f"budget:{user_id}:{period}:{start_date}:{end_date}:{category_ids}:{include_predictions}:{alert_threshold}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return BudgetAnalyticsResponse(**response_data)
        
        # Calculate date range
        date_range = _calculate_date_range(period, start_date, end_date)
        
        # Get budget data
        budget_status = await _get_budget_status(user_id, date_range, category_id_list)
        charts = await _generate_budget_charts(budget_status)
        alerts = await _generate_budget_alerts(budget_status, alert_threshold)
        
        # Calculate overall metrics
        total_budgets = len(budget_status)
        over_budget_count = sum(1 for b in budget_status if b.is_over_budget)
        overall_usage = sum(b.usage_percentage for b in budget_status) / total_budgets if total_budgets > 0 else 0
        
        response_data = BudgetAnalyticsResponse(
            budget_status=budget_status,
            overall_budget_usage=round(overall_usage, 2),
            over_budget_categories=over_budget_count,
            charts=charts,
            alerts=alerts,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_DEFAULT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="budget_analysis",
            resource="budgets",
            over_budget_count=over_budget_count,
            overall_usage=overall_usage
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
            detail=f"Failed to generate budget analytics: {str(e)}"
        )

@router.get("/insights", tags=["Analytics"])
async def get_analytics_insights(
    request: Request,
    period: PeriodType = PeriodType.monthly,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    insight_types: Optional[str] = Query(None, description="Comma-separated insight types"),
    user_id: str = Depends(get_user_id)
):
    """
    Get AI-powered financial insights
    
    Returns:
    - Spending pattern insights
    - Budget recommendations
    - Trend analysis
    - Anomaly detection
    - Personalized suggestions
    """
    start_time = time.time()
    
    try:
        cache_key = f"insights:{user_id}:{period}:{start_date}:{end_date}:{insight_types}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            return json.loads(cached_data)
        
        # Calculate date range
        date_range = _calculate_date_range(period, start_date, end_date)
        
        # Generate insights
        insights = await _generate_comprehensive_insights(user_id, date_range, insight_types)
        
        response_data = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "insights": insights,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Cache result
        await cache_set(cache_key, json.dumps(response_data, default=str), ttl=settings.CACHE_TTL_LONG)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="insights_generated",
            resource="insights",
            insight_count=len(insights)
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
            detail=f"Failed to generate insights: {str(e)}"
        )

# Utility functions
def _calculate_date_range(period: PeriodType, start_date: Optional[date], end_date: Optional[date]) -> dict:
    """Calculate date range based on period or explicit dates"""
    if start_date and end_date:
        return {"start": start_date, "end": end_date}
    
    today = date.today()
    
    if period == PeriodType.daily:
        return {"start": today - timedelta(days=30), "end": today}
    elif period == PeriodType.weekly:
        return {"start": today - timedelta(weeks=12), "end": today}
    elif period == PeriodType.monthly:
        return {"start": today - timedelta(days=90), "end": today}
    elif period == PeriodType.quarterly:
        return {"start": today - timedelta(days=365), "end": today}
    elif period == PeriodType.yearly:
        return {"start": today - timedelta(days=730), "end": today}
    
    return {"start": today - timedelta(days=30), "end": today}

async def _get_overview_data(user_id: str, date_range: dict) -> dict:
    """Get overview financial data"""
    query = """
    SELECT 
        COALESCE(SUM(CASE WHEN e.amount IS NOT NULL THEN e.amount ELSE 0 END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN i.amount IS NOT NULL THEN i.amount ELSE 0 END), 0) as total_income,
        COALESCE(COUNT(e.id), 0) + COALESCE(COUNT(i.id), 0) as transaction_count
    FROM users u
    LEFT JOIN expenses e ON u.id = e.user_id 
        AND e.transaction_date BETWEEN $2 AND $3
    LEFT JOIN income i ON u.id = i.user_id 
        AND i.transaction_date BETWEEN $2 AND $3
    WHERE u.id = $1
    """
    
    result = await execute_fetchrow(query, user_id, date_range["start"], date_range["end"])
    
    total_expenses = Decimal(str(result["total_expenses"])) if result["total_expenses"] else Decimal("0")
    total_income = Decimal(str(result["total_income"])) if result["total_income"] else Decimal("0")
    net_amount = total_income - total_expenses
    
    # Calculate average daily spending
    days = (date_range["end"] - date_range["start"]).days or 1
    avg_daily = total_expenses / days
    
    return {
        "total_expenses": total_expenses,
        "total_income": total_income,
        "net_amount": net_amount,
        "transaction_count": result["transaction_count"] or 0,
        "average_daily_spending": avg_daily
    }

async def _get_top_categories(user_id: str, date_range: dict) -> dict:
    """Get top expense and income categories"""
    # Use the database function we created
    expense_query = "SELECT * FROM get_category_insights($1, 'month') LIMIT 10"
    expense_categories = await execute_query(expense_query, user_id)
    
    # Convert to CategorySummary objects
    expense_summaries = [
        CategorySummary(
            category_id=row["category_id"],
            category_name=row["category_name"],
            total_amount=Decimal(str(row["total_amount"])),
            transaction_count=row["transaction_count"],
            average_amount=Decimal(str(row["avg_transaction"])),
            percentage_of_total=float(row["percentage_of_total"])
        )
        for row in expense_categories
    ]
    
    # For income categories (simplified for now)
    income_summaries = []
    
    return {
        "expenses": expense_summaries,
        "income": income_summaries
    }

async def _generate_overview_charts(user_id: str, date_range: dict, overview_data: dict, top_categories: dict) -> List[ChartData]:
    """Generate charts for overview"""
    charts = []
    
    # Income vs Expenses chart
    income_expense_chart = ChartData(
        chart_type=ChartType.bar,
        title="Income vs Expenses",
        data=[
            {"category": "Income", "amount": float(overview_data["total_income"])},
            {"category": "Expenses", "amount": float(overview_data["total_expenses"])},
            {"category": "Net", "amount": float(overview_data["net_amount"])}
        ],
        config={"colors": ["#22c55e", "#ef4444", "#3b82f6"]}
    )
    charts.append(income_expense_chart)
    
    # Top categories pie chart
    if top_categories["expenses"]:
        category_chart = ChartData(
            chart_type=ChartType.pie,
            title="Top Expense Categories",
            data=[
                {"category": cat.category_name, "amount": float(cat.total_amount)}
                for cat in top_categories["expenses"][:5]
            ]
        )
        charts.append(category_chart)
    
    return charts

async def _generate_overview_insights(overview_data: dict, top_categories: dict) -> List[InsightItem]:
    """Generate insights for overview"""
    insights = []
    
    # Net amount insight
    if overview_data["net_amount"] > 0:
        insights.append(InsightItem(
            type="savings",
            title="Positive Cash Flow",
            description=f"You saved ${overview_data['net_amount']:.2f} this period",
            value=float(overview_data["net_amount"]),
            severity="info"
        ))
    else:
        insights.append(InsightItem(
            type="overspending", 
            title="Negative Cash Flow",
            description=f"You spent ${abs(overview_data['net_amount']):.2f} more than you earned",
            value=float(abs(overview_data["net_amount"])),
            severity="warning",
            action_suggested="Consider reviewing your expense categories"
        ))
    
    return insights

async def _get_period_comparison(user_id: str, date_range: dict, period: PeriodType) -> dict:
    """Get period-over-period comparison"""
    # Implementation for period comparison
    return {"comparison": "period_comparison_data"}

async def _get_category_breakdown(user_id: str, date_range: dict, category_ids: List[str], group_by_type: bool) -> List[CategorySummary]:
    """Get detailed category breakdown"""
    # Implementation for category breakdown
    return []

async def _get_category_time_series(user_id: str, date_range: dict, category_ids: List[str], period: PeriodType) -> List[TimePeriodData]:
    """Get category time series data"""
    # Implementation for time series
    return []

async def _generate_category_charts(categories: List[CategorySummary], time_series: List[TimePeriodData]) -> List[ChartData]:
    """Generate category charts"""
    return []

async def _generate_category_insights(categories: List[CategorySummary], time_series: List[TimePeriodData]) -> List[InsightItem]:
    """Generate category insights"""
    return []

async def _get_budget_status(user_id: str, date_range: dict, category_ids: List[str]) -> List[BudgetStatus]:
    """Get budget status data"""
    return []

async def _generate_budget_charts(budget_status: List[BudgetStatus]) -> List[ChartData]:
    """Generate budget charts"""
    return []

async def _generate_budget_alerts(budget_status: List[BudgetStatus], threshold: float) -> List[InsightItem]:
    """Generate budget alerts"""
    return []

async def _generate_comprehensive_insights(user_id: str, date_range: dict, insight_types: Optional[str]) -> List[InsightItem]:
    """Generate comprehensive insights"""
    return []