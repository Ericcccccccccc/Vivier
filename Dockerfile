# Multi-stage build for TypeScript API with npm workspaces
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files and workspace configuration
COPY package.json package-lock.json ./

# Copy all workspace packages
COPY database-layer ./database-layer
COPY ai-provider-layer ./ai-provider-layer
COPY api-server ./api-server

# Install all dependencies (including workspace dependencies)
RUN npm ci

# Build all workspace packages in dependency order
RUN npm run build:database
RUN npm run build:ai
RUN npm run build:api

# Remove devDependencies after build
RUN npm prune --production

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy everything from builder (already built and pruned)
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/package-lock.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/database-layer ./database-layer
COPY --from=builder --chown=nodejs:nodejs /app/ai-provider-layer ./ai-provider-layer
COPY --from=builder --chown=nodejs:nodejs /app/api-server ./api-server

# Switch to non-root user
USER nodejs

# Set working directory to api-server
WORKDIR /app/api-server

# Expose port (Cloud Run uses PORT env var)
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start with dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]