# Docker Deployment

## Quick Start

1. Copy environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Google Service Account credentials

3. Start services:
   ```bash
   docker-compose up -d
   ```

4. Check status:
   ```bash
   docker-compose ps
   docker-compose logs -f api
   ```

## Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Redis cache |
| api | 3001 | WT Security API |

## Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild API
docker-compose build api
docker-compose up -d api

# Access database
docker-compose exec postgres psql -U postgres -d wt_security

# Manual sync
curl -X POST http://localhost:3001/api/sync
```
