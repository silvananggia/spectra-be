# SPECTRA Web GIS Backend

Production-ready CMS-based Web GIS backend built with Node.js, Express, PostgreSQL/PostGIS, and GeoServer.

## Features

- **Shapefile Upload & Import**: Upload ZIP files containing shapefiles and automatically import them into PostGIS
- **GeoTIFF Upload & Publishing**: Upload GeoTIFF files and publish them as WMS layers in GeoServer
- **Layer Management**: Full CRUD operations for layers (WMS, WFS, XYZ, MVT, GeoJSON)
- **Map Configuration**: Dynamic map configuration API for React frontend
- **GeoServer Integration**: Automated layer publishing via GeoServer REST API
- **PostGIS Database**: Spatial database with proper indexing and extensions

## Tech Stack

- **Node.js 20** - Runtime
- **Express.js** - Web framework
- **PostgreSQL 15** - Database
- **PostGIS 3.3** - Spatial extension
- **Knex.js** - Query builder and migrations
- **GeoServer** - Map server
- **GDAL** - Geospatial data processing
- **Docker** - Containerization

## Project Structure

```
backend/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Server entry point
│   ├── db.js                  # Database connection
│   ├── routes/                # API routes
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   ├── middleware/            # Auth middleware
│   └── utils/                 # Utilities
├── migrations/                # Database migrations
├── Dockerfile                 # Backend container definition
├── docker-compose.yml         # Multi-container setup
└── package.json               # Dependencies
```

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL client tools (for local development)

## Quick Start with Docker

1. **Clone the repository and navigate to backend directory**

```bash
cd backend
```

2. **Create `.env` file** (copy from `.env.example` if available)

```bash
# Copy and modify .env.example
cp .env.example .env
```

3. **Start all services**

```bash
docker-compose up -d
```

This will start:
- PostgreSQL with PostGIS
- GeoServer
- Backend API

4. **Run database migrations**

```bash
# Access backend container
docker-compose exec backend npm run migrate

# Or run migrations manually
docker-compose exec backend knex migrate:latest
```

5. **Access services**

- Backend API: http://localhost:3000
- GeoServer: http://localhost:8080/geoserver
- PostgreSQL: localhost:5432

## Local Development Setup

1. **Install dependencies**

```bash
npm install
```

2. **Set up PostgreSQL**

Ensure PostgreSQL with PostGIS is running. Update `.env` with your database credentials.

3. **Run migrations**

```bash
npm run migrate
```

4. **Start the server**

```bash
npm start

# Or with nodemon for development
npm run dev
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=spectra_gis
DB_USER=postgres
DB_PASSWORD=postgres

# GeoServer
GEOSERVER_URL=http://localhost:8080/geoserver
GEOSERVER_USER=admin
GEOSERVER_PASSWORD=geoserver
GEOSERVER_WORKSPACE=spectra

# Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=100000000
ALLOWED_SHAPEFILE_TYPES=.zip
ALLOWED_RASTER_TYPES=.tif,.tiff

# PostGIS
DEFAULT_EPSG=4326
```

## API Endpoints

### Upload

- `POST /api/upload` - Upload shapefile (.zip) or GeoTIFF (.tif)
  - Requires: Admin authentication
  - Body: multipart/form-data with `file` field
  - Response: Upload ID and status

- `GET /api/upload/:id` - Get upload status
  - Returns: Upload record with processing status

- `GET /api/upload` - List all uploads
  - Requires: Admin authentication

### Maps

- `GET /api/maps` - Get all maps
- `GET /api/maps/:id` - Get map configuration (includes layers)
- `POST /api/maps` - Create new map (requires auth)
- `PUT /api/maps/:id` - Update map (requires auth)

### Layers

- `GET /api/layers` - Get all layers
  - Query params: `map_id`, `type`, `is_visible`, `layer_group_id`
- `GET /api/layers/:id` - Get layer by ID
- `POST /api/layers` - Create layer (requires admin)
- `PUT /api/layers/:id` - Update layer (requires admin)
- `DELETE /api/layers/:id` - Delete layer (requires admin)

### Health

- `GET /health` - Health check endpoint

## Upload Workflow

### Shapefile Upload

1. Admin uploads a ZIP file containing shapefile (.shp, .shx, .dbf, etc.)
2. System extracts ZIP and validates shapefile
3. Shapefile is imported into PostGIS using `shp2pgsql`
4. Spatial index is created automatically
5. Layer is published to GeoServer as a FeatureType
6. Layer is registered in CMS database
7. Response includes WMS URL and layer metadata

### GeoTIFF Upload

1. Admin uploads a GeoTIFF file (.tif)
2. System validates GeoTIFF using `gdalinfo`
3. GeoTIFF is stored in persistent storage
4. Coverage store is created in GeoServer
5. Coverage is published as WMS layer
6. Layer is registered in CMS database
7. Response includes WMS URL and raster metadata

## Database Schema

The system includes 13 core tables:

1. **users** - User accounts
2. **roles** - User roles (admin, user, viewer)
3. **user_roles** - User-role associations
4. **layers** - Layer definitions
5. **layer_groups** - Layer organization
6. **layer_permissions** - Role-based access control
7. **maps** - Map configurations
8. **map_configs** - Map-layer associations
9. **styles** - SLD styles
10. **layer_styles** - Layer-style associations
11. **uploads** - Upload tracking
12. **layer_metadata** - Extended layer metadata
13. **audit_logs** - System audit trail

## Migrations

Run migrations:

```bash
npm run migrate
```

Rollback last migration:

```bash
npm run migrate:rollback
```

Create new migration:

```bash
npm run migrate:make migration_name
```

## Authentication

Currently, authentication middleware is implemented but requires proper JWT/session setup. The middleware expects:
- `x-user-id` header
- `x-user-role` header (should be 'admin' for admin routes)

**Note**: Implement proper authentication (JWT, OAuth, etc.) for production use.

## GeoServer Configuration

GeoServer is automatically configured via REST API:
- Workspace creation
- PostGIS datastore setup
- FeatureType publishing (vector layers)
- Coverage store creation (raster layers)
- Coverage publishing

GeoServer credentials are configurable via environment variables.

## File Storage

- **Shapefiles**: Extracted temporarily, imported to PostGIS, then cleaned up
- **GeoTIFFs**: Stored in `uploads/geotiffs/` directory
- Uploads are tracked in `uploads` table with status and metadata

## Troubleshooting

### GeoServer connection issues

- Verify GeoServer is running: `docker-compose ps`
- Check GeoServer logs: `docker-compose logs geoserver`
- Verify credentials in `.env`

### PostGIS import failures

- Ensure PostGIS extension is enabled: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Check database connection in `.env`
- Verify shapefile SRID matches database SRID

### File upload errors

- Check file size limits in `.env` (MAX_FILE_SIZE)
- Verify upload directory permissions
- Check disk space

## Development

Run with auto-reload:

```bash
npm run dev
```

Check logs:

```bash
docker-compose logs -f backend
```

## Production Considerations

1. **Security**
   - Implement proper authentication (JWT tokens)
   - Use HTTPS
   - Validate and sanitize all inputs
   - Set secure file upload limits
   - Use environment variables for secrets

2. **Performance**
   - Configure connection pooling
   - Use CDN for static assets
   - Enable caching where appropriate
   - Optimize spatial queries with proper indexes

3. **Monitoring**
   - Set up logging (Winston is configured)
   - Monitor database performance
   - Track API response times
   - Set up health checks

4. **Backup**
   - Regular database backups
   - Backup uploaded files
   - GeoServer data directory backup

## License

ISC

