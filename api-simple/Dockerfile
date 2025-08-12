FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including production deps
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY index.js ./

# The PORT env var is set by Cloud Run
EXPOSE 8080

# Run the application
CMD ["node", "index.js"]