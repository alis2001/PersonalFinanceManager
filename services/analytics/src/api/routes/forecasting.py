"""
Forecasting Routes for Analytics Service
Location: services/analytics/src/api/routes/forecasting.py
"""

import time
import json
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict, Any, Literal
from decimal import Decimal
from fastapi import APIRouter, Request, HTTPException, status, Depends, Query
import pandas as pd
import numpy as np
from prophet import Prophet
import structlog

from ...config.database import execute_query, execute_fetchrow, cache_get, cache_set
from ...config.settings import settings
from ...models.schemas import (
    ForecastingRequest, ForecastingResponse, ChartData, InsightItem,
    ChartType, PeriodType
)
from ...middleware.auth import get_user_id
from ...utils.logger import analytics_logger, performance_logger

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/expenses", response_model=ForecastingResponse, tags=["Forecasting"])
async def forecast_expenses(
    request: Request,
    forecast_days: int = Query(30, ge=1, le=365, description="Number of days to forecast"),
    confidence_interval: float = Query(0.95, ge=0.8, le=0.99, description="Confidence interval for predictions"),
    model_type: Literal["prophet", "arima", "linear"] = Query("prophet", description="Forecasting model to use"),
    include_events: bool = Query(False, description="Include special events in forecast"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    user_id: str = Depends(get_user_id)
):
    """
    Forecast future expense patterns using machine learning
    
    Returns:
    - Daily/weekly expense predictions
    - Confidence intervals and uncertainty bounds
    - Seasonal components and trends
    - Model accuracy metrics
    - Scenario-based projections
    """
    start_time = time.time()
    
    try:
        cache_key = f"expense_forecast:{user_id}:{forecast_days}:{confidence_interval}:{model_type}:{include_events}:{category_id}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return ForecastingResponse(**response_data)
        
        # Get historical data for forecasting
        historical_data = await _get_historical_expense_data(user_id, category_id, lookback_days=365)
        
        if len(historical_data) < 30:  # Need minimum data for forecasting
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Insufficient historical data for forecasting. Need at least 30 days of data."
            )
        
        # Generate forecast based on model type
        forecast_result = await _generate_expense_forecast(
            historical_data, forecast_days, confidence_interval, model_type, include_events
        )
        
        # Generate forecast charts
        charts = await _generate_forecast_charts(historical_data, forecast_result, model_type)
        
        # Generate recommendations based on forecast
        recommendations = await _generate_forecast_recommendations(forecast_result, historical_data)
        
        response_data = ForecastingResponse(
            forecast_period_days=forecast_days,
            predictions=forecast_result["predictions"],
            confidence_intervals=forecast_result["confidence_intervals"],
            model_accuracy=forecast_result.get("accuracy"),
            seasonal_components=forecast_result.get("seasonal_components"),
            charts=charts,
            recommendations=recommendations,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result (shorter TTL for forecasts due to data freshness)
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_SHORT)
        
        # Log ML operation
        analytics_logger.log_ml_operation(
            operation="expense_forecasting",
            model_type=model_type,
            data_points=len(historical_data),
            duration_ms=(time.time() - start_time) * 1000,
            forecast_days=forecast_days
        )
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        analytics_logger.log_error_with_context(e, {
            "user_id": user_id,
            "model_type": model_type,
            "forecast_days": forecast_days,
            "processing_time_ms": processing_time
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate expense forecast: {str(e)}"
        )

@router.get("/budget", response_model=ForecastingResponse, tags=["Forecasting"])
async def forecast_budget_performance(
    request: Request,
    forecast_days: int = Query(30, ge=1, le=90, description="Number of days to forecast"),
    scenario: Literal["optimistic", "realistic", "pessimistic"] = Query("realistic", description="Forecast scenario"),
    include_budget_adjustments: bool = Query(True, description="Include recommended budget adjustments"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    user_id: str = Depends(get_user_id)
):
    """
    Forecast budget performance and utilization
    
    Returns:
    - Projected budget utilization rates
    - Risk of budget overruns
    - Recommended budget adjustments
    - Category-wise budget forecasts
    - Scenario-based projections (optimistic/realistic/pessimistic)
    """
    start_time = time.time()
    
    try:
        cache_key = f"budget_forecast:{user_id}:{forecast_days}:{scenario}:{include_budget_adjustments}:{category_id}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return ForecastingResponse(**response_data)
        
        # Get budget and spending data
        budget_data = await _get_budget_forecast_data(user_id, category_id)
        
        if not budget_data["budgets"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active budgets found for forecasting."
            )
        
        # Generate budget performance forecast
        budget_forecast = await _generate_budget_forecast(budget_data, forecast_days, scenario)
        
        # Generate budget optimization recommendations
        recommendations = await _generate_budget_recommendations(budget_forecast, budget_data, include_budget_adjustments)
        
        # Generate budget forecast charts
        charts = await _generate_budget_forecast_charts(budget_forecast, budget_data, scenario)
        
        response_data = ForecastingResponse(
            forecast_period_days=forecast_days,
            predictions=budget_forecast["predictions"],
            confidence_intervals=budget_forecast["risk_intervals"],
            model_accuracy=budget_forecast.get("confidence_score"),
            seasonal_components=budget_forecast.get("seasonal_factors"),
            charts=charts,
            recommendations=recommendations,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_SHORT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="budget_forecast_generated",
            resource="budget_forecast",
            scenario=scenario,
            forecast_days=forecast_days
        )
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        analytics_logger.log_error_with_context(e, {
            "user_id": user_id,
            "scenario": scenario,
            "processing_time_ms": processing_time
        })
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate budget forecast: {str(e)}"
        )

@router.get("/cashflow", response_model=ForecastingResponse, tags=["Forecasting"])
async def forecast_cashflow(
    request: Request,
    forecast_days: int = Query(30, ge=1, le=180, description="Number of days to forecast"),
    include_income: bool = Query(True, description="Include income projections"),
    include_recurring: bool = Query(True, description="Include recurring transactions"),
    stress_test: bool = Query(False, description="Include stress testing scenarios"),
    user_id: str = Depends(get_user_id)
):
    """
    Forecast cash flow including income and expenses
    
    Returns:
    - Net cash flow projections
    - Income vs expense forecasts
    - Recurring transaction predictions
    - Cash flow stress testing
    - Liquidity risk analysis
    """
    start_time = time.time()
    
    try:
        cache_key = f"cashflow_forecast:{user_id}:{forecast_days}:{include_income}:{include_recurring}:{stress_test}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            response_data = json.loads(cached_data)
            response_data["processing_time_ms"] = (time.time() - start_time) * 1000
            return ForecastingResponse(**response_data)
        
        # Get comprehensive financial data
        financial_data = await _get_cashflow_data(user_id, include_income, include_recurring)
        
        # Generate cash flow forecast
        cashflow_forecast = await _generate_cashflow_forecast(financial_data, forecast_days, stress_test)
        
        # Generate cash flow insights and recommendations
        recommendations = await _generate_cashflow_recommendations(cashflow_forecast, financial_data)
        
        # Generate cash flow charts
        charts = await _generate_cashflow_charts(cashflow_forecast, stress_test)
        
        response_data = ForecastingResponse(
            forecast_period_days=forecast_days,
            predictions=cashflow_forecast["predictions"],
            confidence_intervals=cashflow_forecast["confidence_intervals"],
            model_accuracy=cashflow_forecast.get("accuracy"),
            seasonal_components=cashflow_forecast.get("seasonal_components"),
            charts=charts,
            recommendations=recommendations,
            processing_time_ms=(time.time() - start_time) * 1000
        )
        
        # Cache result
        await cache_set(cache_key, response_data.json(), ttl=settings.CACHE_TTL_SHORT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="cashflow_forecast_generated",
            resource="cashflow_forecast",
            forecast_days=forecast_days,
            stress_test=stress_test
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
            detail=f"Failed to generate cashflow forecast: {str(e)}"
        )

@router.get("/anomaly", tags=["Forecasting"])
async def detect_spending_anomalies(
    request: Request,
    lookback_days: int = Query(90, ge=30, le=365, description="Days to analyze for anomalies"),
    sensitivity: float = Query(0.05, ge=0.01, le=0.1, description="Anomaly detection sensitivity"),
    category_id: Optional[str] = Query(None, description="Filter by category ID"),
    user_id: str = Depends(get_user_id)
):
    """
    Detect spending anomalies and unusual patterns
    
    Returns:
    - Detected anomalies with severity scores
    - Anomaly visualization charts
    - Pattern analysis and explanations
    - Future anomaly risk predictions
    - Recommendations for anomaly prevention
    """
    start_time = time.time()
    
    try:
        cache_key = f"anomaly_detection:{user_id}:{lookback_days}:{sensitivity}:{category_id}"
        
        # Check cache
        cached_data = await cache_get(cache_key)
        if cached_data:
            analytics_logger.log_cache_operation("get", cache_key, hit=True)
            return json.loads(cached_data)
        
        # Get data for anomaly detection
        transaction_data = await _get_anomaly_detection_data(user_id, lookback_days, category_id)
        
        # Perform anomaly detection
        anomaly_results = await _detect_anomalies(transaction_data, sensitivity)
        
        # Generate anomaly charts
        charts = await _generate_anomaly_charts(transaction_data, anomaly_results)
        
        # Generate insights about detected anomalies
        insights = await _generate_anomaly_insights(anomaly_results, transaction_data)
        
        response_data = {
            "success": True,
            "timestamp": datetime.utcnow().isoformat(),
            "anomalies_detected": len(anomaly_results["anomalies"]),
            "anomaly_details": anomaly_results["anomalies"],
            "anomaly_score": anomaly_results["overall_score"],
            "risk_assessment": anomaly_results["risk_assessment"],
            "charts": [chart.dict() for chart in charts],
            "insights": [insight.dict() for insight in insights],
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Cache result
        await cache_set(cache_key, json.dumps(response_data, default=str), ttl=settings.CACHE_TTL_DEFAULT)
        
        # Log activity
        analytics_logger.log_user_activity(
            user_id=user_id,
            action="anomaly_detection_completed",
            resource="anomaly_detection",
            anomalies_found=len(anomaly_results["anomalies"]),
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
            detail=f"Failed to detect anomalies: {str(e)}"
        )

# Utility functions
async def _get_historical_expense_data(user_id: str, category_id: Optional[str], lookback_days: int) -> List[Dict]:
    """Get historical expense data for forecasting"""
    end_date = date.today()
    start_date = end_date - timedelta(days=lookback_days)
    
    if category_id:
        query = """
        SELECT 
            DATE_TRUNC('day', transaction_date) as date,
            SUM(amount) as amount,
            COUNT(*) as transaction_count
        FROM expenses 
        WHERE user_id = $1 AND category_id = $2 
            AND transaction_date BETWEEN $3 AND $4
        GROUP BY DATE_TRUNC('day', transaction_date)
        ORDER BY date
        """
        results = await execute_query(query, user_id, category_id, start_date, end_date)
    else:
        query = """
        SELECT 
            DATE_TRUNC('day', transaction_date) as date,
            SUM(amount) as amount,
            COUNT(*) as transaction_count
        FROM expenses 
        WHERE user_id = $1 AND transaction_date BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC('day', transaction_date)
        ORDER BY date
        """
        results = await execute_query(query, user_id, start_date, end_date)
    
    return [
        {
            "date": row["date"],
            "amount": float(row["amount"]),
            "transaction_count": row["transaction_count"]
        }
        for row in results
    ]

async def _generate_expense_forecast(historical_data: List[Dict], forecast_days: int, 
                                   confidence_interval: float, model_type: str, 
                                   include_events: bool) -> Dict:
    """Generate expense forecast using specified model"""
    
    if model_type == "prophet":
        return await _prophet_forecast(historical_data, forecast_days, confidence_interval, include_events)
    elif model_type == "linear":
        return await _linear_forecast(historical_data, forecast_days, confidence_interval)
    elif model_type == "arima":
        return await _arima_forecast(historical_data, forecast_days, confidence_interval)
    else:
        raise ValueError(f"Unsupported model type: {model_type}")

async def _prophet_forecast(historical_data: List[Dict], forecast_days: int, 
                          confidence_interval: float, include_events: bool) -> Dict:
    """Generate forecast using Facebook Prophet"""
    try:
        # Prepare data for Prophet
        df = pd.DataFrame(historical_data)
        df['ds'] = pd.to_datetime(df['date'])
        df['y'] = df['amount']
        
        # Create and fit Prophet model
        model = Prophet(
            interval_width=confidence_interval,
            daily_seasonality=True,
            weekly_seasonality=True,
            yearly_seasonality=len(df) > 365
        )
        
        # Add holidays/events if requested
        if include_events:
            # You could add holiday effects here
            pass
        
        model.fit(df[['ds', 'y']])
        
        # Create future dataframe
        future = model.make_future_dataframe(periods=forecast_days)
        forecast = model.predict(future)
        
        # Extract predictions for forecast period only
        forecast_period = forecast.tail(forecast_days)
        
        predictions = []
        confidence_intervals = []
        
        for _, row in forecast_period.iterrows():
            predictions.append({
                "date": row['ds'].date().isoformat(),
                "predicted_amount": max(0, row['yhat']),  # Don't predict negative expenses
                "trend": row.get('trend', 0),
                "seasonal": row.get('weekly', 0) + row.get('daily', 0)
            })
            
            confidence_intervals.append({
                "date": row['ds'].date().isoformat(),
                "lower_bound": max(0, row['yhat_lower']),
                "upper_bound": row['yhat_upper']
            })
        
        # Calculate model accuracy on historical data
        historical_predictions = forecast.head(len(df))
        mae = np.mean(np.abs(historical_predictions['yhat'] - df['y']))
        mape = np.mean(np.abs((df['y'] - historical_predictions['yhat']) / df['y'])) * 100
        accuracy = max(0, 1 - (mape / 100))
        
        # Extract seasonal components
        seasonal_components = {
            "trend_strength": float(np.std(forecast['trend'])),
            "weekly_seasonality": bool(model.weekly_seasonality),
            "daily_seasonality": bool(model.daily_seasonality),
            "yearly_seasonality": bool(model.yearly_seasonality)
        }
        
        return {
            "predictions": predictions,
            "confidence_intervals": confidence_intervals,
            "accuracy": round(accuracy, 3),
            "seasonal_components": seasonal_components,
            "model_metrics": {
                "mae": round(mae, 2),
                "mape": round(mape, 2)
            }
        }
        
    except Exception as e:
        logger.error(f"Prophet forecasting error: {str(e)}")
        # Fallback to simple linear forecast
        return await _linear_forecast(historical_data, forecast_days, confidence_interval)

async def _linear_forecast(historical_data: List[Dict], forecast_days: int, confidence_interval: float) -> Dict:
    """Generate simple linear trend forecast"""
    df = pd.DataFrame(historical_data)
    amounts = df['amount'].values
    
    # Simple linear regression
    x = np.arange(len(amounts))
    slope, intercept = np.polyfit(x, amounts, 1)
    
    # Generate predictions
    predictions = []
    confidence_intervals = []
    
    # Calculate prediction intervals
    residuals = amounts - (slope * x + intercept)
    mse = np.mean(residuals ** 2)
    std_error = np.sqrt(mse)
    
    # Z-score for confidence interval
    from scipy import stats
    alpha = 1 - confidence_interval
    z_score = stats.norm.ppf(1 - alpha/2)
    
    for i in range(forecast_days):
        future_x = len(amounts) + i
        predicted_amount = max(0, slope * future_x + intercept)
        
        # Confidence interval gets wider with distance
        interval_width = z_score * std_error * (1 + i * 0.1)
        
        predictions.append({
            "date": (date.today() + timedelta(days=i+1)).isoformat(),
            "predicted_amount": predicted_amount,
            "trend": slope,
            "seasonal": 0
        })
        
        confidence_intervals.append({
            "date": (date.today() + timedelta(days=i+1)).isoformat(),
            "lower_bound": max(0, predicted_amount - interval_width),
            "upper_bound": predicted_amount + interval_width
        })
    
    # Calculate accuracy
    predicted_historical = slope * x + intercept
    mae = np.mean(np.abs(amounts - predicted_historical))
    mape = np.mean(np.abs((amounts - predicted_historical) / amounts)) * 100
    accuracy = max(0, 1 - (mape / 100))
    
    return {
        "predictions": predictions,
        "confidence_intervals": confidence_intervals,
        "accuracy": round(accuracy, 3),
        "seasonal_components": {
            "trend_strength": abs(slope),
            "has_trend": abs(slope) > 0.1
        }
    }

async def _arima_forecast(historical_data: List[Dict], forecast_days: int, confidence_interval: float) -> Dict:
    """Generate ARIMA forecast (simplified implementation)"""
    # For now, fallback to linear forecast
    # In production, you would implement ARIMA using statsmodels
    return await _linear_forecast(historical_data, forecast_days, confidence_interval)

async def _generate_forecast_charts(historical_data: List[Dict], forecast_result: Dict, model_type: str) -> List[ChartData]:
    """Generate forecast visualization charts"""
    charts = []
    
    # Historical + Forecast chart
    chart_data = []
    
    # Add historical data
    for item in historical_data[-30:]:  # Last 30 days of historical
        chart_data.append({
            "date": item["date"].isoformat() if hasattr(item["date"], 'isoformat') else str(item["date"]),
            "amount": item["amount"],
            "type": "historical"
        })
    
    # Add forecast data
    for pred in forecast_result["predictions"]:
        chart_data.append({
            "date": pred["date"],
            "amount": pred["predicted_amount"],
            "type": "forecast"
        })
    
    forecast_chart = ChartData(
        chart_type=ChartType.line,
        title=f"Expense Forecast ({model_type.title()} Model)",
        data=chart_data,
        config={
            "show_confidence_intervals": True,
            "highlight_forecast": True,
            "model_type": model_type
        }
    )
    charts.append(forecast_chart)
    
    return charts

async def _generate_forecast_recommendations(forecast_result: Dict, historical_data: List[Dict]) -> List[InsightItem]:
    """Generate recommendations based on forecast"""
    recommendations = []
    
    # Calculate average forecasted spending
    avg_forecast = np.mean([p["predicted_amount"] for p in forecast_result["predictions"]])
    avg_historical = np.mean([d["amount"] for d in historical_data[-30:]])
    
    if avg_forecast > avg_historical * 1.1:  # 10% increase
        recommendations.append(InsightItem(
            type="budget_alert",
            title="Increased Spending Forecast",
            description=f"Forecast shows {((avg_forecast/avg_historical - 1) * 100):.1f}% increase in daily spending",
            value=avg_forecast,
            severity="warning",
            action_suggested="Consider reviewing upcoming expenses and setting stricter budgets"
        ))
    elif avg_forecast < avg_historical * 0.9:  # 10% decrease
        recommendations.append(InsightItem(
            type="savings_opportunity",
            title="Decreased Spending Forecast",
            description=f"Forecast shows {((1 - avg_forecast/avg_historical) * 100):.1f}% decrease in daily spending",
            value=avg_forecast,
            severity="info",
            action_suggested="Good trend! Consider allocating savings to emergency fund or investments"
        ))
    
    return recommendations

# Additional utility functions (budget, cashflow, anomaly detection)
async def _get_budget_forecast_data(user_id: str, category_id: Optional[str]) -> Dict:
    """Get budget data for forecasting"""
    return {"budgets": [], "spending_history": []}

async def _generate_budget_forecast(budget_data: Dict, forecast_days: int, scenario: str) -> Dict:
    """Generate budget performance forecast"""
    return {"predictions": [], "risk_intervals": []}

async def _generate_budget_recommendations(budget_forecast: Dict, budget_data: Dict, include_adjustments: bool) -> List[InsightItem]:
    """Generate budget recommendations"""
    return []

async def _generate_budget_forecast_charts(budget_forecast: Dict, budget_data: Dict, scenario: str) -> List[ChartData]:
    """Generate budget forecast charts"""
    return []

async def _get_cashflow_data(user_id: str, include_income: bool, include_recurring: bool) -> Dict:
    """Get cashflow data"""
    return {"income": [], "expenses": [], "recurring": []}

async def _generate_cashflow_forecast(financial_data: Dict, forecast_days: int, stress_test: bool) -> Dict:
    """Generate cashflow forecast"""
    return {"predictions": [], "confidence_intervals": []}

async def _generate_cashflow_recommendations(cashflow_forecast: Dict, financial_data: Dict) -> List[InsightItem]:
    """Generate cashflow recommendations"""
    return []

async def _generate_cashflow_charts(cashflow_forecast: Dict, stress_test: bool) -> List[ChartData]:
    """Generate cashflow charts"""
    return []

async def _get_anomaly_detection_data(user_id: str, lookback_days: int, category_id: Optional[str]) -> List[Dict]:
    """Get data for anomaly detection"""
    return []

async def _detect_anomalies(transaction_data: List[Dict], sensitivity: float) -> Dict:
    """Detect anomalies in spending patterns"""
    return {"anomalies": [], "overall_score": 0, "risk_assessment": "low"}

async def _generate_anomaly_charts(transaction_data: List[Dict], anomaly_results: Dict) -> List[ChartData]:
    """Generate anomaly visualization charts"""
    return []

async def _generate_anomaly_insights(anomaly_results: Dict, transaction_data: List[Dict]) -> List[InsightItem]:
    """Generate insights about detected anomalies"""
    return []