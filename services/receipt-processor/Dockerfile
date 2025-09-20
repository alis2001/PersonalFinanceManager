# Receipt Processing Service Dockerfile - Python FastAPI
FROM python:3.11-slim

# Install system dependencies for OpenCV and OCR
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1-mesa-dri \
    libgthread-2.0-0 \
    libfontconfig1 \
    libxcb1 \
    libgtk-3-0 \
    python3-opencv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup --gid 1001 --system python && \
    adduser --no-create-home --shell /bin/false --disabled-password --uid 1001 --system --group python

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Set ownership
RUN chown -R python:python /app

# Switch to non-root user
USER python

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8008/health')" || exit 1

# Expose port
EXPOSE 8008

# Start the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8008"]