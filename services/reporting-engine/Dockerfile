# Reporting Engine Dockerfile - C++
FROM ubuntu:22.04 AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install modern C++ compiler
RUN apt-get update && apt-get install -y \
    gcc-11 \
    g++-11 \
    && update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 60 \
    && update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-11 60 \
    && rm -rf /var/lib/apt/lists/*

# Build stage
FROM base AS build

WORKDIR /app

# Copy source files
COPY src/ ./src/
COPY CMakeLists.txt ./

# Create build directory and compile
RUN mkdir -p build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release && \
    make -j$(nproc)

# Runtime stage
FROM ubuntu:22.04 AS runtime

# Create app user
RUN useradd -r -s /bin/false finance-reporting

WORKDIR /app

# Copy binary from build stage
COPY --from=build /app/build/reporting-engine ./

# Set ownership
RUN chown -R finance-reporting:finance-reporting /app

USER finance-reporting

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["./reporting-engine"]