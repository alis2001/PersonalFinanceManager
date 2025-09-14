"""
Enhanced Analytics Routes with Complete Individual Transaction Mapping
Location: services/analytics/src/api/routes/analytics.py
"""

import time
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal

from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import structlog

from ...config.database import execute_query, execute_fetchrow
from ...middleware.auth import get_user_id

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/overview", tags=["Analytics"])
async def get_analytics_overview(
    request: Request,
    period: str = Query("monthly", description="Period: daily, weekly, monthly, quarterly, yearly"),
    user_id: str = Depends(get_user_id)
):
    """
    Analytics Overview with Enhanced Individual Transaction Mapping
    """
    start_time = time.time()
    
    try:
        date_range = calculate_period_date_range(period)
        overview_data = await get_expense_overview(user_id, date_range)
        top_categories = await get_top_categories(user_id, date_range)
        charts = await generate_professional_charts(user_id, date_range, period, top_categories)
        insights = generate_simple_insights(overview_data, top_categories)
        
        response_data = {
            "success": True,
            "total_expenses": float(overview_data["total_expenses"]),
            "total_income": 0,
            "net_amount": -float(overview_data["total_expenses"]),
            "transaction_count": overview_data["transaction_count"],
            "average_daily_spending": float(overview_data["average_daily_spending"]),
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

async def generate_professional_charts(user_id: str, date_range: dict, period: str, top_categories: List[dict]) -> List[dict]:
    """Generate enhanced charts with complete individual transaction mapping"""
    charts = []
    
    # Enhanced Spending Map - All Individual Transactions
    spending_map = await get_individual_transaction_map(user_id, date_range, period)
    if spending_map and spending_map["transactions"]:
        charts.append({
            "chart_type": "line",
            "title": f"Spending Trend Map - All Transactions ({period.title()})",
            "subtitle": f"Displaying {len(spending_map['transactions'])} individual transactions",
            "data": {
                "labels": spending_map["labels"],
                "datasets": [{
                    "label": "Individual Transactions",
                    "data": spending_map["amounts"],
                    "borderColor": "#ef4444",
                    "backgroundColor": "rgba(239, 68, 68, 0.1)",
                    "pointBackgroundColor": spending_map["point_colors"],
                    "pointBorderColor": "#ffffff",
                    "pointBorderWidth": 2,
                    "pointRadius": 6,
                    "pointHoverRadius": 8,
                    "fill": False,
                    "tension": 0.1,
                    "showLine": True
                }]
            },
            "config": {
                "responsive": True,
                "maintainAspectRatio": False,
                "interaction": {
                    "intersect": False,
                    "mode": "index"
                },
                "plugins": {
                    "legend": {"display": True},
                    "tooltip": {
                        "mode": "index",
                        "intersect": False,
                        "callbacks": {
                            "title": "Transaction Details",
                            "label": "Custom tooltip with full transaction info"
                        }
                    }
                },
                "scales": {
                    "y": {
                        "beginAtZero": True,
                        "ticks": {"format": "currency"},
                        "title": {
                            "display": True,
                            "text": "Amount ($)"
                        }
                    },
                    "x": {
                        "type": "time",
                        "time": {
                            "unit": get_time_unit(period)
                        },
                        "title": {
                            "display": True,
                            "text": "Date"
                        }
                    }
                }
            },
            "transaction_details": spending_map["transactions"],
            "maximizable": True,
            "period": period
        })
    
    # Category Distribution Chart
    if top_categories:
        charts.append({
            "chart_type": "doughnut",
            "title": "Spending by Category",
            "data": {
                "labels": [cat["category_name"] for cat in top_categories],
                "datasets": [{
                    "label": "Amount",
                    "data": [cat["total_amount"] for cat in top_categories],
                    "backgroundColor": [cat["category_color"] for cat in top_categories],
                    "borderWidth": 2,
                    "borderColor": "#ffffff"
                }]
            },
            "config": {
                "responsive": True,
                "plugins": {
                    "legend": {"position": "bottom"}
                }
            },
            "maximizable": True
        })
    
    # Monthly Comparison for longer periods
    if period in ["monthly", "quarterly", "yearly"]:
        monthly_comparison = await get_monthly_comparison_data(user_id)
        if monthly_comparison:
            charts.append({
                "chart_type": "area",
                "title": "Monthly Spending Comparison",
                "data": {
                    "labels": monthly_comparison["labels"],
                    "datasets": [{
                        "label": "Monthly Spending",
                        "data": monthly_comparison["amounts"],
                        "borderColor": "#3b82f6",
                        "backgroundColor": "rgba(59, 130, 246, 0.2)",
                        "fill": True
                    }]
                },
                "config": {
                    "responsive": True,
                    "plugins": {
                        "legend": {"display": True}
                    },
                    "scales": {
                        "y": {
                            "beginAtZero": True,
                            "ticks": {"format": "currency"}
                        }
                    }
                },
                "maximizable": True
            })
    
    return charts

async def get_individual_transaction_map(user_id: str, date_range: dict, period: str) -> dict:
    """Get complete individual transaction data for spending map"""
    
    query = """
    SELECT 
        e.id,
        e.amount,
        e.description,
        e.transaction_date,
        e.location,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = $1
        AND e.transaction_date BETWEEN $2 AND $3
    ORDER BY e.transaction_date ASC
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    
    if not results:
        return None
    
    transactions = []
    labels = []
    amounts = []
    point_colors = []
    
    for row in results:
        transaction_date = row["transaction_date"]
        
        # Format date based on period
        if period == "daily":
            label = transaction_date.strftime("%H:%M")
        elif period == "weekly":
            label = transaction_date.strftime("%a %m/%d")
        elif period == "monthly":
            label = transaction_date.strftime("%m/%d")
        elif period == "quarterly":
            label = transaction_date.strftime("%b %d")
        else:  # yearly
            label = transaction_date.strftime("%b %Y")
        
        transaction_detail = {
            "id": str(row["id"]),
            "amount": float(row["amount"]),
            "description": row["description"],
            "date": transaction_date.isoformat(),
            "location": row["location"],
            "category": {
                "name": row["category_name"],
                "color": row["category_color"],
                "icon": row["category_icon"]
            }
        }
        
        transactions.append(transaction_detail)
        labels.append(label)
        amounts.append(float(row["amount"]))
        point_colors.append(row["category_color"] or "#ef4444")
    
    return {
        "transactions": transactions,
        "labels": labels,
        "amounts": amounts,
        "point_colors": point_colors,
        "period": period,
        "total_transactions": len(transactions),
        "total_amount": sum(amounts)
    }

async def get_monthly_comparison_data(user_id: str) -> dict:
    """Get monthly comparison data for the last 12 months"""
    query = """
    SELECT 
        DATE_TRUNC('month', e.transaction_date) as month,
        SUM(e.amount) as total_amount
    FROM expenses e
    WHERE e.user_id = $1
        AND e.transaction_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', e.transaction_date)
    ORDER BY month ASC
    """
    
    results = await execute_query(query, user_id)
    
    if not results:
        return None
    
    return {
        "labels": [row["month"].strftime("%b %Y") for row in results],
        "amounts": [float(row["total_amount"]) for row in results]
    }

def get_time_unit(period: str) -> str:
    """Get Chart.js time unit based on period"""
    time_units = {
        "daily": "hour",
        "weekly": "day", 
        "monthly": "day",
        "quarterly": "week",
        "yearly": "month"
    }
    return time_units.get(period, "day")

def calculate_period_date_range(period: str) -> dict:
    """Calculate date range based on period"""
    end_date = date.today()
    
    if period == "daily":
        start_date = end_date
    elif period == "weekly":
        start_date = end_date - timedelta(days=7)
    elif period == "monthly":
        start_date = end_date - timedelta(days=30)
    elif period == "quarterly":
        start_date = end_date - timedelta(days=90)
    else:  # yearly
        start_date = end_date - timedelta(days=365)
    
    return {
        "start": start_date,
        "end": end_date
    }

async def get_expense_overview(user_id: str, date_range: dict) -> dict:
    """Get expense overview from database"""
    query = """
    SELECT 
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as transaction_count,
        COALESCE(AVG(amount), 0) as avg_transaction_amount
    FROM expenses 
    WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
    """
    
    result = await execute_fetchrow(query, user_id, date_range["start"], date_range["end"])
    
    if not result:
        return {
            "total_expenses": Decimal("0"),
            "transaction_count": 0,
            "average_daily_spending": Decimal("0")
        }
    
    total_expenses = Decimal(str(result["total_expenses"]))
    days = (date_range["end"] - date_range["start"]).days or 1
    avg_daily = total_expenses / days
    
    return {
        "total_expenses": total_expenses,
        "transaction_count": result["transaction_count"],
        "average_daily_spending": avg_daily
    }

async def get_top_categories(user_id: str, date_range: dict) -> List[dict]:
    """Get top expense categories from database"""
    query = """
    SELECT 
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as transaction_count
    FROM categories c
    LEFT JOIN expenses e ON c.id = e.category_id 
        AND e.user_id = $1 
        AND e.transaction_date BETWEEN $2 AND $3
    WHERE c.user_id = $1 AND c.type IN ('expense', 'both')
    GROUP BY c.id, c.name, c.color, c.icon
    HAVING COALESCE(SUM(e.amount), 0) > 0
    ORDER BY total_amount DESC
    LIMIT 5
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    total_expenses = sum(Decimal(str(row["total_amount"])) for row in results)
    
    categories = []
    for row in results:
        amount = Decimal(str(row["total_amount"]))
        percentage = float((amount / total_expenses * 100)) if total_expenses > 0 else 0
        
        categories.append({
            "category_name": row["category_name"],
            "category_color": row["category_color"] or "#64748b",
            "category_icon": row["category_icon"] or "💰",
            "total_amount": float(amount),
            "percentage_of_total": percentage,
            "transaction_count": row["transaction_count"]
        })
    
    return categories

def generate_simple_insights(overview_data: dict, top_categories: List[dict]) -> List[dict]:
    """Generate insights from data"""
    insights = []
    
    total_expenses = overview_data["total_expenses"]
    transaction_count = overview_data["transaction_count"]
    avg_daily = overview_data["average_daily_spending"]
    
    if total_expenses > 0:
        insights.append({
            "type": "spending_summary",
            "title": "Spending Summary",
            "description": f"You spent ${total_expenses:.2f} across {transaction_count} transactions, averaging ${avg_daily:.2f} per day.",
            "severity": "info"
        })
    
    if top_categories:
        top_cat = top_categories[0]
        insights.append({
            "type": "top_category",
            "title": f"Highest Spending: {top_cat['category_name']}",
            "description": f"Your largest expense category is {top_cat['category_name']} at ${top_cat['total_amount']:.2f} ({top_cat['percentage_of_total']:.1f}% of total).",
            "severity": "warning" if top_cat["percentage_of_total"] > 40 else "info"
        })
    
    if transaction_count > 0:
        avg_transaction = float(total_expenses) / transaction_count
        insights.append({
            "type": "transaction_pattern",
            "title": "Transaction Pattern",
            "description": f"You averaged ${avg_transaction:.2f} per transaction with {transaction_count} total transactions.",
            "severity": "info"
        })
    
    return insights