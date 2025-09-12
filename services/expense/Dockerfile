# Expense Service Dockerfile - Node.js
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S finance-expense -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production && npm cache clean --force

# Copy application code
COPY src/ ./src/

# Change ownership to non-root user
RUN chown -R finance-expense:nodejs /app

# Switch to non-root user
USER finance-expense

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]