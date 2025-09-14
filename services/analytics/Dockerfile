# Analytics Service Dockerfile - Python FastAPI
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Build stage
FROM base AS build

# Install build dependencies for TA-Lib and other compiled packages
RUN apt-get update && apt-get install -y \
    wget \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Install TA-Lib (required for technical analysis)
RUN wget http://prdownloads.sourceforge.net/ta-lib/ta-lib-0.4.0-src.tar.gz && \
    tar -xvzf ta-lib-0.4.0-src.tar.gz && \
    cd ta-lib/ && \
    ./configure --prefix=/usr && \
    make && \
    make install && \
    cd .. && \
    rm -rf ta-lib*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM base AS runtime

# Copy TA-Lib from build stage
COPY --from=build /usr/lib/libta_lib* /usr/lib/
COPY --from=build /usr/include/ta-lib/ /usr/include/ta-lib/

# Create non-root user
RUN groupadd -r finance-analytics && \
    useradd -r -g finance-analytics -s /bin/bash finance-analytics

# Set working directory
WORKDIR /app

# Copy installed packages from build stage
COPY --from=build /usr/local/lib/python3.11/site-packages/ /usr/local/lib/python3.11/site-packages/
COPY --from=build /usr/local/bin/ /usr/local/bin/

# Copy application source code
COPY src/ ./src/
COPY alembic/ ./alembic/ 
COPY alembic.ini ./
COPY pyproject.toml ./

# Create necessary directories
RUN mkdir -p logs cache exports && \
    chown -R finance-analytics:finance-analytics /app

# Switch to non-root user
USER finance-analytics

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Start command with proper async support
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--loop", "asyncio"]