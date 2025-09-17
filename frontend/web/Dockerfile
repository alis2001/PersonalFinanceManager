# Production Web Frontend Dockerfile - React.js - FIXED API URL
FROM node:18-alpine as builder

# Set npm configurations for better reliability
RUN npm config set fetch-retry-mintimeout 20000
RUN npm config set fetch-retry-maxtimeout 120000
RUN npm config set fetch-retries 3
RUN npm config set registry https://registry.npmjs.org/

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json ./

# Install dependencies with retry logic
RUN npm install --no-optional --loglevel=error --progress=false

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# FIXED: Use build argument for API URL (allows dev/prod flexibility)
ARG REACT_APP_API_URL=http://localhost:8080/api
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV NODE_ENV=production

# Build for production
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built app to nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S finance-web -u 1001

# Set permissions
RUN chown -R finance-web:nodejs /usr/share/nginx/html
RUN chown -R finance-web:nodejs /var/cache/nginx
RUN chown -R finance-web:nodejs /var/log/nginx
RUN chown -R finance-web:nodejs /etc/nginx/conf.d
RUN touch /var/run/nginx.pid
RUN chown finance-web:nodejs /var/run/nginx.pid

USER finance-web

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]