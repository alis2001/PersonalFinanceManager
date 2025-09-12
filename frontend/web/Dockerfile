# Web Frontend Dockerfile - React.js
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S finance-web -u 1001

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install && npm cache clean --force

# Copy application code
COPY src/ ./src/
COPY public/ ./public/

# Change ownership to non-root user
RUN chown -R finance-web:nodejs /app

# Switch to non-root user
USER finance-web

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]