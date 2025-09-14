"""
REAL Analytics Implementation - Actually queries your data
Location: services/analytics/src/api/routes/analytics_real.py

This file contains ACTUAL implementations that query your expense data from PostgreSQL
Replace the stub functions in analytics.py with these REAL implementations.
"""

import time
import json
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal
from collections import defaultdict

from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import structlog

from ...config.database import execute_query, execute_fetchrow, cache_get, cache_set
from ...config.settings import settings
from ...middleware.auth import get_user_id

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/analytics/overview", tags=["Analytics"])
async def get_analytics_overview_real(
    request: Request,
    period: str = Query("monthly", description="Period: daily, weekly, monthly, quarterly, yearly"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    include_comparisons: bool = Query(True, description="Include period comparisons"),
    user_id: str = Depends(get_user_id)
):
    """
    REAL Analytics Overview - Queries actual expense data from database
    """
    start_time = time.time()
    
    try:
        # Calculate date range
        date_range = calculate_date_range(period, start_date, end_date)
        
        # Get REAL expense data from database
        overview_data = await get_real_expense_overview(user_id, date_range)
        
        # Get REAL top categories
        top_categories = await get_real_top_categories(user_id, date_range)
        
        # Generate REAL chart data
        charts = await generate_real_charts(user_id, date_range, period, top_categories)
        
        # Generate REAL insights
        insights = await generate_real_insights(overview_data, top_categories)
        
        # Period comparison if requested
        period_comparison = None
        if include_comparisons:
            period_comparison = await get_real_period_comparison(user_id, date_range, period)
        
        response_data = {
            "success": True,
            "total_expenses": float(overview_data["total_expenses"]),
            "total_income": 0,  # Not needed for now as requested
            "net_amount": -float(overview_data["total_expenses"]),  # Negative because only expenses
            "transaction_count": overview_data["transaction_count"],
            "average_daily_spending": float(overview_data["average_daily_spending"]),
            "period_comparison": period_comparison,
            "top_expense_categories": top_categories,
            "charts": charts,
            "insights": insights,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except Exception as e:
        logger.error("Analytics overview failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate analytics overview: {str(e)}"
        )

@router.get("/analytics/categories", tags=["Analytics"])
async def get_category_analytics_real(
    request: Request,
    period: str = Query("monthly", description="Period type"),
    start_date: Optional[str] = Query(None, description="Start date"),
    end_date: Optional[str] = Query(None, description="End date"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    user_id: str = Depends(get_user_id)
):
    """
    REAL Category Analytics - Actual category breakdown and comparison
    """
    try:
        date_range = calculate_date_range(period, start_date, end_date)
        
        # Parse category filter
        category_filter = category_ids.split(',') if category_ids else None
        
        # Get detailed category analysis
        category_data = await get_real_category_breakdown(user_id, date_range, category_filter)
        
        # Get time series for category trends
        time_series = await get_real_category_time_series(user_id, date_range, period, category_filter)
        
        # Generate category comparison charts
        charts = await generate_category_comparison_charts(category_data, time_series, period)
        
        return {
            "success": True,
            "categories": category_data,
            "time_series": time_series,
            "charts": charts,
            "total_categories": len(category_data),
            "period": period,
            "date_range": {
                "start": date_range["start"].isoformat(),
                "end": date_range["end"].isoformat()
            }
        }
        
    except Exception as e:
        logger.error("Category analytics failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get category analytics: {str(e)}"
        )

# REAL IMPLEMENTATION FUNCTIONS

def calculate_date_range(period: str, start_date: Optional[str], end_date: Optional[str]) -> dict:
    """Calculate actual date range based on period or explicit dates"""
    if start_date and end_date:
        return {
            "start": datetime.strptime(start_date, "%Y-%m-%d").date(),
            "end": datetime.strptime(end_date, "%Y-%m-%d").date()
        }
    
    today = date.today()
    
    if period == "daily":
        return {"start": today - timedelta(days=30), "end": today}
    elif period == "weekly":
        return {"start": today - timedelta(weeks=12), "end": today}
    elif period == "monthly":
        return {"start": today - timedelta(days=90), "end": today}
    elif period == "quarterly":
        return {"start": today - timedelta(days=365), "end": today}
    elif period == "yearly":
        return {"start": today - timedelta(days=730), "end": today}
    
    return {"start": today - timedelta(days=30), "end": today}

async def get_real_expense_overview(user_id: str, date_range: dict) -> dict:
    """Get REAL expense overview data from database"""
    query = """
    SELECT 
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as transaction_count,
        COALESCE(AVG(amount), 0) as avg_transaction_amount
    FROM expenses 
    WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
    """
    
    result = await execute_fetchrow(query, user_id, date_range["start"], date_range["end"])
    
    total_expenses = Decimal(str(result["total_expenses"])) if result["total_expenses"] else Decimal("0")
    
    # Calculate average daily spending
    days = (date_range["end"] - date_range["start"]).days or 1
    avg_daily = total_expenses / days
    
    return {
        "total_expenses": total_expenses,
        "transaction_count": result["transaction_count"] or 0,
        "average_daily_spending": avg_daily,
        "average_transaction_amount": Decimal(str(result["avg_transaction_amount"])) if result["avg_transaction_amount"] else Decimal("0")
    }

async def get_real_top_categories(user_id: str, date_range: dict) -> List[dict]:
    """Get REAL top expense categories from database"""
    query = """
    SELECT 
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as transaction_count,
        COALESCE(AVG(e.amount), 0) as avg_amount
    FROM categories c
    LEFT JOIN expenses e ON c.id = e.category_id 
        AND e.user_id = $1 
        AND e.transaction_date BETWEEN $2 AND $3
    WHERE c.user_id = $1 AND c.type IN ('expense', 'both')
    GROUP BY c.id, c.name, c.color, c.icon
    HAVING COALESCE(SUM(e.amount), 0) > 0
    ORDER BY total_amount DESC
    LIMIT 10
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    
    # Calculate total for percentages
    total_expenses = sum(Decimal(str(row["total_amount"])) for row in results)
    
    categories = []
    for row in results:
        amount = Decimal(str(row["total_amount"]))
        percentage = float((amount / total_expenses * 100)) if total_expenses > 0 else 0
        
        categories.append({
            "category_name": row["category_name"],
            "category_color": row["category_color"],
            "category_icon": row["category_icon"],
            "total_amount": float(amount),
            "percentage_of_total": percentage,
            "transaction_count": row["transaction_count"],
            "average_amount": float(row["avg_amount"])
        })
    
    return categories

async def generate_real_charts(user_id: str, date_range: dict, period: str, top_categories: List[dict]) -> List[dict]:
    """Generate REAL chart data from actual database queries"""
    charts = []
    
    # 1. Monthly spending trend chart
    monthly_trend = await get_monthly_spending_trend(user_id, date_range)
    if monthly_trend:
        charts.append({
            "chart_type": "line",
            "title": "Monthly Spending Trend",
            "data": monthly_trend,
            "config": {
                "x_axis": "month",
                "y_axis": "amount",
                "color": "#ef4444"
            }
        })
    
    # 2. Category breakdown pie chart
    if top_categories:
        charts.append({
            "chart_type": "pie",
            "title": "Expenses by Category",
            "data": [
                {
                    "name": cat["category_name"],
                    "value": cat["total_amount"],
                    "color": cat["category_color"] or "#64748b"
                }
                for cat in top_categories[:8]  # Top 8 for better visualization
            ],
            "config": {
                "show_percentages": True
            }
        })
    
    # 3. Weekly spending pattern
    weekly_pattern = await get_weekly_spending_pattern(user_id, date_range)
    if weekly_pattern:
        charts.append({
            "chart_type": "bar",
            "title": "Spending by Day of Week",
            "data": weekly_pattern,
            "config": {
                "x_axis": "day",
                "y_axis": "amount",
                "color": "#3b82f6"
            }
        })
    
    return charts

async def get_monthly_spending_trend(user_id: str, date_range: dict) -> List[dict]:
    """Get actual monthly spending trend"""
    query = """
    SELECT 
        DATE_TRUNC('month', transaction_date) as month,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
    FROM expenses 
    WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
    GROUP BY DATE_TRUNC('month', transaction_date)
    ORDER BY month
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    
    return [
        {
            "month": row["month"].strftime("%Y-%m"),
            "amount": float(row["total_amount"]),
            "transaction_count": row["transaction_count"]
        }
        for row in results
    ]

async def get_weekly_spending_pattern(user_id: str, date_range: dict) -> List[dict]:
    """Get spending pattern by day of week"""
    query = """
    SELECT 
        EXTRACT(DOW FROM transaction_date) as day_of_week,
        TO_CHAR(transaction_date, 'Day') as day_name,
        AVG(amount) as avg_amount,
        COUNT(*) as transaction_count
    FROM expenses 
    WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
    GROUP BY EXTRACT(DOW FROM transaction_date), TO_CHAR(transaction_date, 'Day')
    ORDER BY day_of_week
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    
    return [
        {
            "day": row["day_name"].strip(),
            "amount": float(row["avg_amount"]),
            "transaction_count": row["transaction_count"]
        }
        for row in results
    ]

async def get_real_category_breakdown(user_id: str, date_range: dict, category_filter: Optional[List[str]]) -> List[dict]:
    """Get detailed category breakdown with filtering"""
    where_clause = "AND c.id = ANY($4)" if category_filter else ""
    params = [user_id, date_range["start"], date_range["end"]]
    if category_filter:
        params.append(category_filter)
    
    query = f"""
    SELECT 
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as transaction_count,
        COALESCE(AVG(e.amount), 0) as avg_amount,
        COALESCE(MIN(e.amount), 0) as min_amount,
        COALESCE(MAX(e.amount), 0) as max_amount
    FROM categories c
    LEFT JOIN expenses e ON c.id = e.category_id 
        AND e.user_id = $1 
        AND e.transaction_date BETWEEN $2 AND $3
    WHERE c.user_id = $1 AND c.type IN ('expense', 'both') {where_clause}
    GROUP BY c.id, c.name, c.color, c.icon
    ORDER BY total_amount DESC
    """
    
    results = await execute_query(query, *params)
    
    return [
        {
            "category_id": row["category_id"],
            "category_name": row["category_name"],
            "category_color": row["category_color"],
            "category_icon": row["category_icon"],
            "total_amount": float(row["total_amount"]),
            "transaction_count": row["transaction_count"],
            "average_amount": float(row["avg_amount"]),
            "min_amount": float(row["min_amount"]),
            "max_amount": float(row["max_amount"])
        }
        for row in results
    ]

async def get_real_category_time_series(user_id: str, date_range: dict, period: str, category_filter: Optional[List[str]]) -> List[dict]:
    """Get category spending over time"""
    # Determine time truncation based on period
    if period == "daily":
        trunc = "day"
    elif period == "weekly":
        trunc = "week"
    elif period == "monthly":
        trunc = "month"
    else:
        trunc = "month"
    
    where_clause = "AND e.category_id = ANY($4)" if category_filter else ""
    params = [user_id, date_range["start"], date_range["end"]]
    if category_filter:
        params.append(category_filter)
    
    query = f"""
    SELECT 
        c.name as category_name,
        c.color as category_color,
        DATE_TRUNC('{trunc}', e.transaction_date) as period,
        SUM(e.amount) as amount
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = $1 AND e.transaction_date BETWEEN $2 AND $3 {where_clause}
    GROUP BY c.name, c.color, DATE_TRUNC('{trunc}', e.transaction_date)
    ORDER BY period, c.name
    """
    
    results = await execute_query(query, *params)
    
    return [
        {
            "category_name": row["category_name"],
            "category_color": row["category_color"],
            "period": row["period"].isoformat(),
            "amount": float(row["amount"])
        }
        for row in results
    ]

async def generate_category_comparison_charts(category_data: List[dict], time_series: List[dict], period: str) -> List[dict]:
    """Generate category comparison charts"""
    charts = []
    
    # Category comparison bar chart
    if category_data:
        charts.append({
            "chart_type": "bar",
            "title": "Category Comparison",
            "data": [
                {
                    "category": cat["category_name"],
                    "amount": cat["total_amount"],
                    "color": cat["category_color"] or "#64748b"
                }
                for cat in category_data[:10]
            ],
            "config": {
                "x_axis": "category",
                "y_axis": "amount",
                "horizontal": True
            }
        })
    
    # Time series chart for categories
    if time_series:
        charts.append({
            "chart_type": "line",
            "title": f"Category Trends ({period.title()})",
            "data": time_series,
            "config": {
                "x_axis": "period",
                "y_axis": "amount",
                "group_by": "category_name",
                "multi_line": True
            }
        })
    
    return charts

async def generate_real_insights(overview_data: dict, top_categories: List[dict]) -> List[dict]:
    """Generate REAL insights from actual data"""
    insights = []
    
    total_expenses = overview_data["total_expenses"]
    transaction_count = overview_data["transaction_count"]
    avg_daily = overview_data["average_daily_spending"]
    
    # Spending level insight
    if total_expenses > 0:
        insights.append({
            "type": "spending_summary",
            "title": "Spending Summary",
            "description": f"You spent ${total_expenses:.2f} across {transaction_count} transactions, averaging ${avg_daily:.2f} per day.",
            "severity": "info",
            "value": float(total_expenses)
        })
    
    # Top category insight
    if top_categories:
        top_cat = top_categories[0]
        insights.append({
            "type": "top_category",
            "title": f"Highest Spending: {top_cat['category_name']}",
            "description": f"Your largest expense category is {top_cat['category_name']} at ${top_cat['total_amount']:.2f} ({top_cat['percentage_of_total']:.1f}% of total spending).",
            "severity": "warning" if top_cat["percentage_of_total"] > 40 else "info",
            "value": top_cat["total_amount"]
        })
    
    # Transaction frequency insight
    if transaction_count > 0:
        avg_transaction = float(total_expenses) / transaction_count
        insights.append({
            "type": "transaction_pattern",
            "title": "Transaction Pattern",
            "description": f"You averaged ${avg_transaction:.2f} per transaction with {transaction_count} total transactions.",
            "severity": "info",
            "value": avg_transaction
        })
    
    return insights

async def get_real_period_comparison(user_id: str, date_range: dict, period: str) -> dict:
    """Get real period-over-period comparison"""
    # Calculate previous period
    days_diff = (date_range["end"] - date_range["start"]).days
    prev_end = date_range["start"] - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days_diff)
    
    # Get current period data
    current_query = """
    SELECT COALESCE(SUM(amount), 0) as total_amount
    FROM expenses 
    WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
    """
    
    current_result = await execute_fetchrow(current_query, user_id, date_range["start"], date_range["end"])
    previous_result = await execute_fetchrow(current_query, user_id, prev_start, prev_end)
    
    current_amount = float(current_result["total_amount"]) if current_result["total_amount"] else 0
    previous_amount = float(previous_result["total_amount"]) if previous_result["total_amount"] else 0
    
    # Calculate percentage change
    if previous_amount > 0:
        change_percent = ((current_amount - previous_amount) / previous_amount) * 100
    else:
        change_percent = 100 if current_amount > 0 else 0
    
    return {
        "current_period": current_amount,
        "previous_period": previous_amount,
        "change_amount": current_amount - previous_amount,
        "change_percentage": change_percent,
        "trend": "up" if change_percent > 0 else "down" if change_percent < 0 else "stable"
    }