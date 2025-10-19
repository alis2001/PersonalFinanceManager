"""
Analytics Routes with Individual Transaction Mapping
Location: services/analytics/src/api/routes/analytics.py
"""

import time
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal

from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import structlog
import jdatetime

from ...config.database import execute_query, execute_fetchrow
from ...middleware.auth import get_user_id

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/hierarchical", tags=["Analytics"])
async def get_hierarchical_analytics(
    request: Request,
    period: str = Query("monthly", description="Period: daily, weekly, monthly, quarterly, yearly"),
    user_id: str = Depends(get_user_id)
):
    """
    Get hierarchical category analytics with spending breakdown
    """
    start_time = time.time()
    
    try:
        # Get user's currency to determine date system
        user_currency = await get_user_currency(user_id)
        
        # Calculate date range for the period based on user's currency
        date_range = calculate_period_date_range(period, user_currency)
        
        # Get hierarchical categories with spending data
        hierarchical_categories = await get_hierarchical_categories(user_id, date_range)
        
        # Get total expenses for percentage calculations
        overview_data = await get_expense_overview(user_id, date_range)
        
        response_data = {
            "success": True,
            "period": period,
            "date_range": date_range,
            "total_expenses": float(overview_data["total_expenses"]),
            "hierarchical_categories": hierarchical_categories,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Hierarchical analytics error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate hierarchical analytics: {str(e)}"
        )

@router.get("/category/{category_id}/breakdown", tags=["Analytics"])
async def get_category_breakdown_analytics(
    category_id: str,
    request: Request,
    period: str = Query("monthly", description="Period: daily, weekly, monthly, quarterly, yearly"),
    user_id: str = Depends(get_user_id)
):
    """
    Get detailed breakdown for a specific category and its children
    """
    start_time = time.time()
    
    try:
        # Get user's currency to determine date system
        user_currency = await get_user_currency(user_id)
        
        # Calculate date range for the period based on user's currency
        date_range = calculate_period_date_range(period, user_currency)
        
        # Get category breakdown
        breakdown_data = await get_category_breakdown(user_id, category_id, date_range)
        
        response_data = {
            "success": True,
            "period": period,
            "date_range": date_range,
            "breakdown": breakdown_data,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except Exception as e:
        logger.error(f"Category breakdown error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate category breakdown: {str(e)}"
        )

@router.get("/overview", tags=["Analytics"])
async def get_analytics_overview(
    request: Request,
    period: str = Query("monthly", description="Period: daily, weekly, monthly, quarterly, yearly"),
    user_id: str = Depends(get_user_id)
):
    """
    Real Analytics Overview with Individual Transaction Mapping
    """
    start_time = time.time()
    
    try:
        # Get user's currency to determine date system
        user_currency = await get_user_currency(user_id)
        
        # Calculate date range for the period based on user's currency
        date_range = calculate_period_date_range(period, user_currency)
        
        # Debug logging
        logger.info(f"[ANALYTICS] Period: {period}, Currency: {user_currency}, Date range: {date_range['start']} to {date_range['end']}")
        
        # Get real expense overview
        overview_data = await get_expense_overview(user_id, date_range)
        
        # Get real top categories
        top_categories = await get_top_categories(user_id, date_range)
        
        # Generate REAL PROFESSIONAL CHARTS with individual transactions
        charts = await generate_professional_charts(user_id, date_range, period, top_categories)
        
        # Generate simple insights
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

# ENHANCED CHART GENERATION WITH INDIVIDUAL TRANSACTIONS

async def generate_professional_charts(user_id: str, date_range: dict, period: str, top_categories: List[dict]) -> List[dict]:
    """Generate professional charts with individual transaction mapping"""
    charts = []
    
    # 1. DOUGHNUT CHART - Category Breakdown
    if top_categories:
        charts.append({
            "chart_type": "doughnut",
            "title": "Expense Distribution by Category",
            "data": [
                {
                    "label": cat["category_name"],
                    "value": cat["total_amount"],
                    "color": cat["category_color"],
                    "percentage": cat["percentage_of_total"]
                }
                for cat in top_categories
            ],
            "config": {
                "responsive": True,
                "plugins": {
                    "legend": {"position": "bottom"},
                    "tooltip": {"format": "currency"}
                }
            }
        })
    
    # 2. BAR CHART - Top Categories
    if top_categories:
        charts.append({
            "chart_type": "bar",
            "title": "Top Spending Categories",
            "data": {
                "labels": [cat["category_name"] for cat in top_categories],
                "datasets": [{
                    "label": "Amount Spent",
                    "data": [cat["total_amount"] for cat in top_categories],
                    "backgroundColor": [cat["category_color"] for cat in top_categories],
                    "borderColor": [cat["category_color"] for cat in top_categories],
                    "borderWidth": 1
                }]
            },
            "config": {
                "responsive": True,
                "plugins": {
                    "legend": {"display": False}
                },
                "scales": {
                    "y": {
                        "beginAtZero": True,
                        "ticks": {"format": "currency"}
                    }
                }
            }
        })
    
    # 3. ENHANCED SPENDING MAP - Individual Transactions
    spending_map = await get_individual_transaction_map(user_id, date_range, period)
    if spending_map and spending_map["transactions"]:
        charts.append({
            "chart_type": "line",
            "title": f"Spending Map - All Transactions ({period.title()})",
            "subtitle": f"Showing {len(spending_map['transactions'])} individual transactions",
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
                "interaction": {
                    "intersect": False,
                    "mode": "index"
                },
                "plugins": {
                    "legend": {"display": True},
                    "tooltip": {
                        "callbacks": {
                            "title": "Transaction Details",
                            "label": "Custom tooltip with transaction info"
                        }
                    }
                },
                "scales": {
                    "y": {
                        "beginAtZero": True,
                        "ticks": {"format": "currency"}
                    },
                    "x": {
                        "type": "time",
                        "time": {
                            "unit": get_time_unit(period)
                        }
                    }
                }
            },
            "transaction_details": spending_map["transactions"],  # Extra data for tooltips
            "maximizable": True  # Enable maximize feature
        })
    
    # 4. MONTHLY COMPARISON (for longer periods)
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
                }
            })
    
    return charts

async def get_individual_transaction_map(user_id: str, date_range: dict, period: str) -> dict:
    """Get individual transaction data for spending map"""
    
    query = """
    SELECT 
        e.id,
        e.amount,
        e.description,
        e.user_date,
        e.user_time,
        e.transaction_date,
        e.location,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = $1
        AND e.user_date >= $2 AND e.user_date < $3
    ORDER BY e.user_date ASC, e.user_time ASC
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    
    if not results:
        return None
    
    transactions = []
    labels = []
    amounts = []
    point_colors = []
    
    for row in results:
        # Format transaction data using user's local date/time
        transaction_data = {
            "id": str(row["id"]),
            "amount": float(row["amount"]),
            "description": row["description"] or "No description",
            "date": row["user_date"].strftime("%Y-%m-%d"),
            "time": str(row["user_time"])[:5] if row["user_time"] else "00:00",  # HH:MM format
            "location": row["location"] or "No location",
            "category": row["category_name"],
            "category_color": row["category_color"] or "#64748b",
            "category_icon": row["category_icon"] or "💰"
        }
        
        transactions.append(transaction_data)
        
        # Format labels based on period using user's local date/time
        if period == "daily":
            labels.append(str(row["user_time"])[:5] if row["user_time"] else "00:00")  # HH:MM
        else:
            labels.append(row["user_date"].strftime("%m/%d"))
        
        amounts.append(float(row["amount"]))
        point_colors.append(row["category_color"] or "#64748b")
    
    return {
        "transactions": transactions,
        "labels": labels,
        "amounts": amounts,
        "point_colors": point_colors,
        "total_transactions": len(transactions),
        "period": period
    }

async def get_user_currency(user_id: str) -> str:
    """Get user's default currency from database"""
    try:
        query = "SELECT default_currency FROM users WHERE id = $1"
        result = await execute_fetchrow(query, user_id)
        return result["default_currency"] if result else "USD"
    except Exception as e:
        logger.warning("Failed to get user currency", user_id=user_id, error=str(e))
        return "USD"

def calculate_period_date_range(period: str, user_currency: str = "USD") -> dict:
    """Calculate exact date range for the selected period"""
    today = date.today()
    
    # For IRR users, use Persian calendar calculations
    if user_currency == "IRR":
        return calculate_persian_period_date_range(period)
    
    # For all other currencies, use Gregorian calendar
    if period == "daily":
        # Today only
        start_date = today
        end_date = today
    elif period == "weekly":
        # This week (Monday to Sunday, end+1 for < comparison)
        days_since_monday = today.weekday()
        start_date = today - timedelta(days=days_since_monday)
        end_date = start_date + timedelta(days=7)  # Next Monday for < comparison
    elif period == "monthly":
        # This month (start to end+1 for < comparison)
        start_date = today.replace(day=1)
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1)
    elif period == "quarterly":
        # This quarter (end+1 for < comparison)
        quarter = (today.month - 1) // 3 + 1
        start_month = (quarter - 1) * 3 + 1
        start_date = today.replace(month=start_month, day=1)
        
        if quarter == 4:
            end_date = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end_month = quarter * 3 + 1
            end_date = today.replace(month=end_month, day=1)
    elif period == "yearly":
        # This year (end+1 for < comparison)
        start_date = today.replace(month=1, day=1)
        end_date = today.replace(year=today.year + 1, month=1, day=1)
    else:
        # Default to current month (end+1 for < comparison)
        start_date = today.replace(day=1)
        if today.month == 12:
            end_date = today.replace(year=today.year + 1, month=1, day=1)
        else:
            end_date = today.replace(month=today.month + 1, day=1)
    
    return {"start": start_date, "end": end_date}

def calculate_persian_period_date_range(period: str) -> dict:
    """Calculate date range using Persian calendar for IRR users"""
    today_persian = jdatetime.date.today()
    today_gregorian = date.today()
    
    if period == "daily":
        # Today only
        start_date = today_gregorian
        end_date = today_gregorian
    elif period == "weekly":
        # Persian week calculation - Persian week starts on Saturday
        # jdatetime.weekday() returns: 0=Saturday, 1=Sunday, 2=Monday, ..., 6=Friday
        persian_weekday = today_persian.weekday()
        # Days since Saturday (start of Persian week)
        days_since_saturday = persian_weekday
        
        # Get start of Persian week (Saturday)
        start_persian = today_persian - timedelta(days=days_since_saturday)
        # Get end of Persian week (Friday) + 1 day to include the full Friday
        end_persian = start_persian + timedelta(days=7)
        
        # Convert to Gregorian for database queries
        start_date = start_persian.togregorian()
        end_date = end_persian.togregorian()
    elif period == "monthly":
        # Current Persian month (end+1 for < comparison)
        # Get first day of current Persian month
        start_persian = jdatetime.date(today_persian.year, today_persian.month, 1)
        # Get first day of NEXT Persian month for < comparison
        if today_persian.month == 12:
            end_persian = jdatetime.date(today_persian.year + 1, 1, 1)
        else:
            end_persian = jdatetime.date(today_persian.year, today_persian.month + 1, 1)
        
        # Convert to Gregorian for database queries
        start_date = start_persian.togregorian()
        end_date = end_persian.togregorian()
    elif period == "quarterly":
        # Current Persian quarter (end+1 for < comparison)
        quarter = (today_persian.month - 1) // 3 + 1
        start_month = (quarter - 1) * 3 + 1
        start_persian = jdatetime.date(today_persian.year, start_month, 1)
        
        # First day of next quarter for < comparison
        if quarter == 4:
            end_persian = jdatetime.date(today_persian.year + 1, 1, 1)
        else:
            end_month = quarter * 3 + 1
            end_persian = jdatetime.date(today_persian.year, end_month, 1)
        
        # Convert to Gregorian for database queries
        start_date = start_persian.togregorian()
        end_date = end_persian.togregorian()
    elif period == "yearly":
        # Current Persian year (end+1 for < comparison)
        start_persian = jdatetime.date(today_persian.year, 1, 1)
        # First day of next year for < comparison
        end_persian = jdatetime.date(today_persian.year + 1, 1, 1)
        
        # Convert to Gregorian for database queries
        start_date = start_persian.togregorian()
        end_date = end_persian.togregorian()
    else:
        # Default to current Persian month (end+1 for < comparison)
        start_persian = jdatetime.date(today_persian.year, today_persian.month, 1)
        if today_persian.month == 12:
            end_persian = jdatetime.date(today_persian.year + 1, 1, 1)
        else:
            end_persian = jdatetime.date(today_persian.year, today_persian.month + 1, 1)
        
        # Convert to Gregorian for database queries
        start_date = start_persian.togregorian()
        end_date = end_persian.togregorian()
    
    return {"start": start_date, "end": end_date}

def get_time_unit(period: str) -> str:
    """Get appropriate time unit for chart x-axis"""
    if period == "daily":
        return "hour"
    elif period == "weekly":
        return "day"
    elif period == "monthly":
        return "day"
    elif period == "quarterly":
        return "week"
    elif period == "yearly":
        return "month"
    else:
        return "day"

async def get_monthly_comparison_data(user_id: str) -> dict:
    """Get monthly comparison data"""
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

# EXISTING HELPER FUNCTIONS (keep all previous functions)

async def get_expense_overview(user_id: str, date_range: dict) -> dict:
    """Get real expense overview from database - using user_date for timezone-independent filtering"""
    # Use >= and < to properly include the full end date
    # date_range["end"] is the day AFTER the last day we want to include
    query = """
    SELECT 
        COALESCE(SUM(amount), 0) as total_expenses,
        COUNT(*) as transaction_count,
        COALESCE(AVG(amount), 0) as avg_transaction_amount
    FROM expenses 
    WHERE user_id = $1 AND user_date >= $2 AND user_date < $3
    """
    
    logger.info(f"[ANALYTICS] Query: {query}, Params: user_id={user_id}, start={date_range['start']}, end={date_range['end']}")
    
    result = await execute_fetchrow(query, user_id, date_range["start"], date_range["end"])
    
    logger.info(f"[ANALYTICS] Result: total={result['total_expenses'] if result else 0}, count={result['transaction_count'] if result else 0}")
    
    if not result:
        return {
            "total_expenses": Decimal("0"),
            "transaction_count": 0,
            "average_daily_spending": Decimal("0")
        }
    
    total_expenses = Decimal(str(result["total_expenses"]))
    
    # Calculate average daily spending
    days = (date_range["end"] - date_range["start"]).days or 1
    avg_daily = total_expenses / days
    
    return {
        "total_expenses": total_expenses,
        "transaction_count": result["transaction_count"],
        "average_daily_spending": avg_daily
    }

async def get_top_categories(user_id: str, date_range: dict) -> List[dict]:
    """Get real top expense categories from database - using user_date for timezone-independent filtering"""
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
        AND e.user_date >= $2 AND e.user_date < $3
    WHERE c.user_id = $1 AND c.type IN ('expense', 'both')
    GROUP BY c.id, c.name, c.color, c.icon
    HAVING COALESCE(SUM(e.amount), 0) > 0
    ORDER BY total_amount DESC
    LIMIT 5
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
            "category_color": row["category_color"] or "#64748b",
            "category_icon": row["category_icon"] or "💰",
            "total_amount": float(amount),
            "percentage_of_total": percentage,
            "transaction_count": row["transaction_count"]
        })
    
    return categories

async def get_hierarchical_categories(user_id: str, date_range: dict) -> List[dict]:
    """Get hierarchical category breakdown with spending data"""
    query = """
    SELECT 
        c.id,
        c.name as category_name,
        c.description,
        c.color as category_color,
        c.icon as category_icon,
        c.parent_id,
        c.level,
        c.path,
        c.path_ids,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as transaction_count
    FROM categories c
    LEFT JOIN expenses e ON c.id = e.category_id 
        AND e.user_id = $1 
        AND e.user_date >= $2 AND e.user_date < $3
    WHERE c.user_id = $1 AND c.type IN ('expense', 'both') AND c.is_active = true
    GROUP BY c.id, c.name, c.description, c.color, c.icon, c.parent_id, c.level, c.path, c.path_ids
    ORDER BY c.level ASC, c.path ASC
    """
    
    results = await execute_query(query, user_id, date_range["start"], date_range["end"])
    
    # Calculate total for percentages
    total_expenses = sum(Decimal(str(row["total_amount"])) for row in results)
    
    # Build hierarchical structure
    category_map = {}
    root_categories = []
    
    for row in results:
        category = {
            "id": str(row["id"]),
            "name": row["category_name"],
            "description": row["description"],
            "color": row["category_color"] or "#64748b",
            "icon": row["category_icon"] or "💰",
            "parent_id": str(row["parent_id"]) if row["parent_id"] else None,
            "level": row["level"],
            "path": row["path"],
            "path_ids": row["path_ids"] or [],
            "total_amount": float(Decimal(str(row["total_amount"]))),
            "percentage_of_total": float((Decimal(str(row["total_amount"])) / total_expenses * 100)) if total_expenses > 0 else 0,
            "transaction_count": row["transaction_count"],
            "children": []
        }
        
        category_map[str(row["id"])] = category
        
        if row["parent_id"]:
            parent_id = str(row["parent_id"])
            if parent_id in category_map:
                category_map[parent_id]["children"].append(category)
        else:
            root_categories.append(category)
    
    # Add children to parents
    for category in category_map.values():
        if category["parent_id"] and category["parent_id"] in category_map:
            parent = category_map[category["parent_id"]]
            if category not in parent["children"]:
                parent["children"].append(category)
    
    return root_categories

async def get_category_breakdown(user_id: str, category_id: str, date_range: dict) -> dict:
    """Get detailed breakdown for a specific category and its children"""
    query = """
    WITH RECURSIVE category_tree AS (
        -- Base case: the selected category
        SELECT id, name, color, icon, parent_id, level, path, path_ids
        FROM categories 
        WHERE id = $1 AND user_id = $2
        
        UNION ALL
        
        -- Recursive case: children of the category
        SELECT c.id, c.name, c.color, c.icon, c.parent_id, c.level, c.path, c.path_ids
        FROM categories c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.user_id = $2 AND c.is_active = true
    )
    SELECT 
        ct.id,
        ct.name as category_name,
        ct.color as category_color,
        ct.icon as category_icon,
        ct.level,
        ct.path,
        COALESCE(SUM(e.amount), 0) as total_amount,
        COUNT(e.id) as transaction_count
    FROM category_tree ct
    LEFT JOIN expenses e ON ct.id = e.category_id 
        AND e.user_id = $2 
        AND e.user_date >= $3 AND e.user_date < $4
    GROUP BY ct.id, ct.name, ct.color, ct.icon, ct.level, ct.path
    ORDER BY ct.level ASC, total_amount DESC
    """
    
    results = await execute_query(query, category_id, user_id, date_range["start"], date_range["end"])
    
    # Calculate total for percentages
    total_amount = sum(Decimal(str(row["total_amount"])) for row in results)
    
    breakdown = []
    for row in results:
        amount = Decimal(str(row["total_amount"]))
        breakdown.append({
            "id": str(row["id"]),
            "name": row["category_name"],
            "color": row["category_color"] or "#64748b",
            "icon": row["category_icon"] or "💰",
            "level": row["level"],
            "path": row["path"],
            "total_amount": float(amount),
            "percentage_of_total": float((amount / total_amount * 100)) if total_amount > 0 else 0,
            "transaction_count": row["transaction_count"]
        })
    
    return {
        "category_id": category_id,
        "breakdown": breakdown,
        "total_amount": float(total_amount)
    }

def generate_simple_insights(overview_data: dict, top_categories: List[dict]) -> List[dict]:
    """Generate simple insights from real data"""
    insights = []
    
    total_expenses = overview_data["total_expenses"]
    transaction_count = overview_data["transaction_count"]
    avg_daily = overview_data["average_daily_spending"]
    
    # Basic spending insight
    if total_expenses > 0:
        insights.append({
            "type": "spending_summary",
            "title": "Spending Summary",
            "description": f"You spent ${total_expenses:.2f} across {transaction_count} transactions, averaging ${avg_daily:.2f} per day.",
            "severity": "info"
        })
    
    # Top category insight
    if top_categories:
        top_cat = top_categories[0]
        insights.append({
            "type": "top_category",
            "title": f"Highest Spending: {top_cat['category_name']}",
            "description": f"Your largest expense category is {top_cat['category_name']} at ${top_cat['total_amount']:.2f} ({top_cat['percentage_of_total']:.1f}% of total).",
            "severity": "warning" if top_cat["percentage_of_total"] > 40 else "info"
        })
    
    # Transaction frequency insight
    if transaction_count > 0:
        avg_transaction = float(total_expenses) / transaction_count
        insights.append({
            "type": "transaction_pattern",
            "title": "Transaction Pattern",
            "description": f"You averaged ${avg_transaction:.2f} per transaction with {transaction_count} total transactions.",
            "severity": "info"
        })
    
    return insights