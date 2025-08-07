FROM node:20-alpine

# Install dependencies for Baileys
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --production && \
    npm install -g typescript

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Copy other necessary files
COPY ecosystem.config.js ./

# Create necessary directories
RUN mkdir -p logs session backups

# Install PM2
RUN npm install -g pm2

# Expose health check port
EXPOSE 3001

# Set environment to production
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["pm2-runtime", "start", "ecosystem.config.js"]