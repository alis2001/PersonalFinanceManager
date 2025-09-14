"""
Pydantic Models and Schemas for Analytics Service
Location: services/analytics/src/models/schemas.py
"""

from datetime import date, datetime
from typing import List, Optional, Dict, Any, Union, Literal
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field, validator, root_validator
import uuid

# Enums for controlled values
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
    heatmap = "heatmap"
    treemap = "treemap"
    waterfall = "waterfall"
    gauge = "gauge"
    scatter = "scatter"

class ExportFormat(str, Enum):
    csv = "csv"
    excel = "excel"
    json = "json"
    pdf = "pdf"

class TrendDirection(str, Enum):
    increasing = "increasing"
    decreasing = "decreasing"
    stable = "stable"

# Base request/response models
class BaseRequest(BaseModel):
    """Base request model with common fields"""
    period: Optional[PeriodType] = PeriodType.monthly
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    
    @validator('end_date')
    def end_date_after_start_date(cls, v, values):
        if v and values.get('start_date') and v <= values['start_date']:
            raise ValueError('end_date must be after start_date')
        return v

class BaseResponse(BaseModel):
    """Base response model with common fields"""
    success: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    processing_time_ms: Optional[float] = None

# Analytics Request Models
class AnalyticsOverviewRequest(BaseRequest):
    """Request for analytics overview"""
    include_forecasting: bool = False
    include_comparisons: bool = True
    
class CategoryAnalyticsRequest(BaseRequest):
    """Request for category-specific analytics"""
    category_ids: Optional[List[uuid.UUID]] = None
    include_subcategories: bool = True
    group_by_type: bool = True

class BudgetAnalyticsRequest(BaseRequest):
    """Request for budget analysis"""
    category_ids: Optional[List[uuid.UUID]] = None
    include_predictions: bool = False
    alert_threshold: float = Field(default=0.8, ge=0.0, le=1.0)

class TrendsRequest(BaseRequest):
    """Request for trend analysis"""
    category_id: Optional[uuid.UUID] = None
    trend_type: Literal["spending", "income", "savings"] = "spending"
    include_seasonality: bool = True
    smoothing: bool = False

class ForecastingRequest(BaseRequest):
    """Request for forecasting analysis"""
    forecast_days: int = Field(default=30, ge=1, le=365)
    confidence_interval: float = Field(default=0.95, ge=0.8, le=0.99)
    model_type: Literal["prophet", "arima", "linear"] = "prophet"
    include_events: bool = False

class ExportRequest(BaseRequest):
    """Request for data export"""
    format: ExportFormat
    include_charts: bool = False
    chart_types: Optional[List[ChartType]] = None
    
# Analytics Response Models
class CategorySummary(BaseModel):
    """Category summary data"""
    category_id: uuid.UUID
    category_name: str
    total_amount: Decimal
    transaction_count: int
    average_amount: Decimal
    percentage_of_total: float
    trend: Optional[TrendDirection] = None
    trend_percentage: Optional[float] = None

class TimePeriodData(BaseModel):
    """Time period data point"""
    period: str  # ISO date string or period label
    amount: Decimal
    transaction_count: int
    categories: Optional[List[CategorySummary]] = None

class BudgetStatus(BaseModel):
    """Budget status information"""
    category_id: uuid.UUID
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
    config: Dict[str, Any] = {}
    
class InsightItem(BaseModel):
    """Individual insight"""
    type: str
    title: str
    description: str
    value: Optional[Union[str, float, int]] = None
    severity: Literal["info", "warning", "critical"] = "info"
    action_suggested: Optional[str] = None

# Main Response Models
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
    config: Dict[str, Any] = {}

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
class HealthResponse(BaseModel):
    """Health check response"""
    status: Literal["healthy", "unhealthy"]
    service: str = "Analytics Service"
    version: str
    timestamp: float
    environment: str
    database: Dict[str, Any]
    redis: Dict[str, Any]
    system: Optional[Dict[str, Any]] = None

# Pagination Models
class PaginationRequest(BaseModel):
    """Pagination request parameters"""
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=50, ge=1, le=1000)
    sort_by: Optional[str] = None
    sort_order: Literal["asc", "desc"] = "desc"

class PaginationResponse(BaseModel):
    """Pagination response metadata"""
    page: int
    limit: int
    total: int
    pages: int
    has_next: bool
    has_previous: bool

# Cache Models
class CacheInfo(BaseModel):
    """Cache information"""
    cached: bool
    cache_key: Optional[str] = None
    expires_at: Optional[datetime] = None
    ttl_seconds: Optional[int] = None

# Analytics Event Models (for internal use)
class AnalyticsEvent(BaseModel):
    """Analytics event for tracking"""
    event_type: str
    event_data: Dict[str, Any]
    user_id: uuid.UUID
    amount: Optional[Decimal] = None
    category_id: Optional[uuid.UUID] = None
    occurred_at: datetime = Field(default_factory=datetime.utcnow)

# Validation helpers
class DateRangeValidator:
    """Date range validation helper"""
    
    @staticmethod
    def validate_date_range(start_date: date, end_date: date, max_days: int = 365) -> None:
        if end_date <= start_date:
            raise ValueError("end_date must be after start_date")
        
        days_diff = (end_date - start_date).days
        if days_diff > max_days:
            raise ValueError(f"Date range cannot exceed {max_days} days")

# Model aliases for backward compatibility
OverviewRequest = AnalyticsOverviewRequest
OverviewResponse = AnalyticsOverviewResponse