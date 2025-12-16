# Use osgeo/gdal as base image (includes GDAL tools)
FROM osgeo/gdal:ubuntu-small-3.6.3

# Set working directory
WORKDIR /app

# Install Node.js 20
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install PostgreSQL client (for shp2pgsql and psql)
RUN apt-get update && \
    apt-get install -y postgresql-client postgis && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verify installations
RUN node --version && \
    npm --version && \
    gdalinfo --version && \
    shp2pgsql -? && \
    psql --version

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create upload directories
RUN mkdir -p uploads/temp uploads/geotiffs logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "src/server.js"]

