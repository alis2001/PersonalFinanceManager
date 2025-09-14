"""
Complete Pydantic Models for Analytics Service
Location: services/analytics/src/models/schemas.py
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any, Union, Literal
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field, validator


# Enums
class PeriodType(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    yearly = "yearly"


class ChartType(str, Enum):
    line = "line"
    bar = "bar"
    pie = "pie"
    doughnut = "doughnut"
    area = "area"
    scatter = "scatter"
    heatmap = "heatmap"
    treemap = "treemap"


class TrendDirection(str, Enum):
    increasing = "increasing"
    decreasing = "decreasing"
    stable = "stable"
    volatile = "volatile"


class ExportFormat(str, Enum):
    csv = "csv"
    xlsx = "xlsx"
    json = "json"
    pdf = "pdf"


class InsightSeverity(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class ForecastModel(str, Enum):
    prophet = "prophet"
    arima = "arima"
    linear = "linear"
    ensemble = "ensemble"


# Base Models
class BaseResponse(BaseModel):
    """Base response model with common fields"""
    success: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_time_ms: Optional[float] = None


class BaseRequest(BaseModel):
    """Base request model with common fields"""
    period: PeriodType = PeriodType.monthly
    start_date: Optional[date] = None
    end_date: Optional[date] = None


# Core Data Models
class CategorySummary(BaseModel):
    """Category summary with financial data"""
    category_id: str
    category_name: str
    total_amount: Decimal
    transaction_count: int
    average_amount: Decimal
    percentage_of_total: float
    trend_direction: Optional[TrendDirection] = None
    trend_percentage: Optional[float] = None


class TimePeriodData(BaseModel):
    """Time series data point"""
    period: str  # ISO date string or period identifier
    amount: Decimal
    transaction_count: int
    average_amount: Optional[Decimal] = None
    period_type: PeriodType
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BudgetStatus(BaseModel):
    """Budget usage and status information"""
    category_id: str
    category_name: str
    budget_amount: Decimal
    spent_amount: Decimal
    remaining_amount: Decimal
    usage_percentage: float
    is_over_budget: bool
    days_remaining: Optional[int] = None


class ChartData(BaseModel):
    """Chart data structure"""
    chart_type: ChartType
    title: str
    data: List[Dict[str, Any]]
    config: Dict[str, Any] = Field(default_factory=dict)
    
    
class InsightItem(BaseModel):
    """Individual insight"""
    type: str
    title: str
    description: str
    value: Optional[Union[str, float, int]] = None
    severity: InsightSeverity = InsightSeverity.info
    action_suggested: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Request Models
class AnalyticsOverviewRequest(BaseRequest):
    """Analytics overview request parameters"""
    include_forecasting: bool = False
    include_comparisons: bool = True


class CategoryAnalyticsRequest(BaseRequest):
    """Category analytics request parameters"""
    category_ids: Optional[List[str]] = None
    include_subcategories: bool = True
    group_by_type: bool = True


class BudgetAnalyticsRequest(BaseRequest):
    """Budget analytics request parameters"""
    category_ids: Optional[List[str]] = None
    include_alerts: bool = True


class TrendsRequest(BaseRequest):
    """Trends analysis request parameters"""
    include_seasonality: bool = True
    smoothing: bool = False
    category_id: Optional[str] = None


class ForecastingRequest(BaseRequest):
    """Forecasting request parameters"""
    forecast_days: int = Field(default=30, ge=1, le=365)
    confidence_interval: float = Field(default=0.95, ge=0.8, le=0.99)
    model_type: ForecastModel = ForecastModel.prophet
    include_events: bool = False
    category_id: Optional[str] = None


# Response Models
class AnalyticsOverviewResponse(BaseResponse):
    """Analytics overview response"""
    total_expenses: Decimal
    total_income: Decimal
    net_amount: Decimal
    transaction_count: int
    average_daily_spending: Decimal
    
    # Period comparison
    period_comparison: Optional[Dict[str, Any]] = None
    
    # Top categories
    top_expense_categories: List[CategorySummary]
    top_income_categories: List[CategorySummary]
    
    # Charts
    charts: List[ChartData]
    
    # Insights
    insights: List[InsightItem]


class CategoryAnalyticsResponse(BaseResponse):
    """Category analytics response"""
    categories: List[CategorySummary]
    time_series: List[TimePeriodData]
    charts: List[ChartData]
    insights: List[InsightItem]


class BudgetAnalyticsResponse(BaseResponse):
    """Budget analysis response"""
    budget_status: List[BudgetStatus]
    overall_budget_usage: float
    over_budget_categories: int
    charts: List[ChartData]
    alerts: List[InsightItem]


class TrendsResponse(BaseResponse):
    """Trends analysis response"""
    trend_direction: TrendDirection
    trend_strength: float  # 0.0 to 1.0
    trend_percentage: float
    seasonal_patterns: Optional[Dict[str, Any]] = None
    time_series: List[TimePeriodData]
    charts: List[ChartData]
    predictions: Optional[Dict[str, Any]] = None


class ForecastingResponse(BaseResponse):
    """Forecasting analysis response"""
    forecast_period_days: int
    predictions: List[Dict[str, Any]]
    confidence_intervals: List[Dict[str, Any]]
    model_accuracy: Optional[float] = None
    seasonal_components: Optional[Dict[str, Any]] = None
    charts: List[ChartData]
    recommendations: List[InsightItem]


# Export Models
class ExportResponse(BaseResponse):
    """Export response"""
    download_url: Optional[str] = None
    file_size_bytes: Optional[int] = None
    expires_at: Optional[datetime] = None
    format: ExportFormat
    

# Error Models
class ErrorDetail(BaseModel):
    """Error detail structure"""
    code: str
    message: str
    field: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model"""
    success: bool = False
    error: str
    details: Optional[List[ErrorDetail]] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Chart Configuration Models
class ChartConfig(BaseModel):
    """Chart configuration"""
    width: int = Field(default=800, ge=200, le=2000)
    height: int = Field(default=600, ge=200, le=1500)
    theme: Literal["light", "dark"] = "light"
    show_legend: bool = True
    interactive: bool = True
    color_scheme: Optional[List[str]] = None


class DashboardLayoutItem(BaseModel):
    """Dashboard widget layout item"""
    widget_type: str
    position: Dict[str, int]  # {x, y, w, h}
    config: Dict[str, Any] = Field(default_factory=dict)


class DashboardLayout(BaseModel):
    """Dashboard layout configuration"""
    layout: Literal["grid", "flow"] = "grid"
    widgets: List[DashboardLayoutItem]


class UserPreferences(BaseModel):
    """User analytics preferences"""
    default_period: PeriodType = PeriodType.monthly
    preferred_charts: List[ChartType] = [ChartType.line, ChartType.bar, ChartType.pie]
    dashboard_layout: Optional[DashboardLayout] = None
    timezone: str = "UTC"


# Health Check Models
class SystemInfo(BaseModel):
    """System information"""
    python_version: str
    fastapi_version: str
    pandas_version: str
    numpy_version: str
    environment: str


class DatabaseStatus(BaseModel):
    """Database connection status"""
    status: str
    response_time_ms: Optional[float] = None
    pool_size: Optional[int] = None
    active_connections: Optional[int] = None
    error: Optional[str] = None


class RedisStatus(BaseModel):
    """Redis connection status"""
    status: str
    response_time_ms: Optional[float] = None
    connected_clients: Optional[int] = None
    used_memory: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    """Comprehensive health check response"""
    status: str
    service: str = "Analytics Service"
    version: str
    timestamp: float
    environment: str
    database: DatabaseStatus
    redis: RedisStatus
    system: SystemInfo


# Machine Learning Models
class MLModelInfo(BaseModel):
    """Machine learning model information"""
    name: str
    version: str
    accuracy: Optional[float] = None
    last_trained: Optional[datetime] = None
    features_count: Optional[int] = None
    model_type: str


class PredictionResult(BaseModel):
    """Prediction result from ML models"""
    predicted_value: float
    confidence: float
    probability_distribution: Optional[Dict[str, float]] = None
    feature_importance: Optional[Dict[str, float]] = None


class AnomalyDetectionResult(BaseModel):
    """Anomaly detection result"""
    is_anomaly: bool
    anomaly_score: float
    threshold: float
    explanation: Optional[str] = None
    affected_features: Optional[List[str]] = None


# Advanced Analytics Models
class SegmentationResult(BaseModel):
    """User/transaction segmentation result"""
    segment_id: str
    segment_name: str
    description: str
    size: int
    characteristics: Dict[str, Any]


class CorrelationAnalysis(BaseModel):
    """Correlation analysis between variables"""
    variable_x: str
    variable_y: str
    correlation_coefficient: float
    p_value: float
    significance_level: float = 0.05
    is_significant: bool


class SeasonalityAnalysis(BaseModel):
    """Seasonality analysis results"""
    has_seasonality: bool
    seasonal_period: Optional[int] = None
    seasonal_strength: Optional[float] = None
    trend_strength: Optional[float] = None
    seasonal_components: Optional[Dict[str, float]] = None


# Batch Processing Models
class BatchJobStatus(BaseModel):
    """Batch job processing status"""
    job_id: str
    status: Literal["pending", "running", "completed", "failed"]
    progress_percentage: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    results_location: Optional[str] = None


class BulkAnalyticsRequest(BaseModel):
    """Bulk analytics processing request"""
    user_ids: List[str]
    analysis_types: List[str]
    parameters: Dict[str, Any] = Field(default_factory=dict)
    priority: Literal["low", "medium", "high"] = "medium"


# Validation
@validator('period', pre=True, always=True)
def validate_period(cls, v):
    """Ensure period is valid"""
    if isinstance(v, str):
        return PeriodType(v.lower())
    return v


# Model validators for common fields
def validate_positive_decimal(v):
    """Validate decimal is positive"""
    if v < 0:
        raise ValueError("Amount must be positive")
    return v


def validate_percentage(v):
    """Validate percentage is between 0 and 100"""
    if not 0 <= v <= 100:
        raise ValueError("Percentage must be between 0 and 100")
    return v


# Apply validators to relevant models
CategorySummary.__annotations__["total_amount"] = Decimal
CategorySummary.__annotations__["average_amount"] = Decimal
BudgetStatus.__annotations__["budget_amount"] = Decimal
BudgetStatus.__annotations__["spent_amount"] = Decimal

# Add field validators
for model in [CategorySummary, BudgetStatus, AnalyticsOverviewResponse]:
    for field_name, field_type in model.__annotations__.items():
        if field_type == Decimal or (hasattr(field_type, '__origin__') and field_type.__origin__ is Union):
            if 'amount' in field_name.lower():
                model.__fields__[field_name].validators = [validate_positive_decimal]
        elif 'percentage' in field_name.lower():
            model.__fields__[field_name].validators = [validate_percentage]