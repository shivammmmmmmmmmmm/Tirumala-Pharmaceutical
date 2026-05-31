# Deployment Guide

Complete guide for deploying the Medical Product Distribution System to production.

## Architecture Overview

```
┌─────────────────┐
│  Vercel (CDN)   │
│  Frontend       │
└────────┬────────┘
         │ HTTPS
┌────────▼────────────────┐
│  Your API Server        │
│  (Express Backend)      │
└────────┬────────────────┘
         │
┌────────▼────────────────┐
│  Neon PostgreSQL        │
│  (Database)             │
└─────────────────────────┘
```

## Deployment Options

### Option 1: Vercel (Recommended for Frontend + Serverless Backend)

#### Frontend Deployment
```bash
cd frontend
vercel deploy --prod
```

#### Backend Deployment (Serverless)
Convert Express to Vercel serverless functions:

```bash
cd backend
vercel deploy --prod
```

Set environment variables in Vercel dashboard:
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

### Option 2: Docker + Cloud Provider (AWS, GCP, Azure)

#### Create Docker setup for backend:

**backend/Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Build
RUN pnpm build

# Run
EXPOSE 3001
CMD ["node", "dist/server.js"]
```

**Docker Compose (for testing):**
```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: medical_db
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

### Option 3: Traditional Server (AWS EC2, DigitalOcean, Heroku)

#### SSH into server and setup:

```bash
# Install dependencies
curl -fsSL https://get.pnpm.io/install.sh | sh -
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone <your-repo-url>
cd medical-distribution-system

# Install
pnpm install

# Build backend
cd backend && pnpm build && cd ..

# Setup environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# Start with PM2
npm install -g pm2
pm2 start dist/server.js --name "medical-api"
pm2 save
pm2 startup

# Deploy frontend
cd frontend
npm run build
# Deploy to Vercel or your static hosting
```

## Environment Configuration

### Production Environment Variables

**Backend (.env):**
```
# Database
DATABASE_URL=postgresql://user:password@neon-host/database

# Server
PORT=3001
NODE_ENV=production

# Auth
JWT_SECRET=<generate-with: openssl rand -base64 32>

# CORS
FRONTEND_URL=https://your-domain.com
```

**Frontend (.env.production):**
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
```

## Database Setup

### Using Neon PostgreSQL (Recommended)

1. Go to [neon.tech](https://neon.tech)
2. Create project and database
3. Copy connection string
4. Set as `DATABASE_URL` in environment

### Using Self-Hosted PostgreSQL

1. Create database: `createdb medical_db`
2. Run schema creation (already done in development)
3. Backup strategy: Daily backups to S3/Cloud Storage

## SSL/TLS Certificates

### For HTTPS

**Option 1: Let's Encrypt (Free)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d api.your-domain.com
```

**Option 2: AWS Certificate Manager**
- Use ACM to issue free certificates
- Attach to CloudFront or ALB

## Monitoring & Logging

### Application Monitoring
```bash
# PM2 Monitoring
pm2 install pm2-logrotate
pm2 monit

# Or use external service
npm install --save winston
```

### Database Monitoring
- Use Neon dashboard for query monitoring
- Set up slow query alerts
- Monitor connection pooling

### Error Tracking
```bash
# Optional: Sentry
npm install @sentry/node
```

## Backup Strategy

### Database Backups
```bash
# Daily backups with pg_dump
0 2 * * * pg_dump $DATABASE_URL > /backups/backup-$(date +\%Y-\%m-\%d).sql
```

### Data Retention
- Daily backups: 7 days
- Weekly backups: 4 weeks
- Monthly backups: 1 year

## Security Checklist

- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS/TLS everywhere
- [ ] Configure CORS for your domain only
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable rate limiting on API endpoints
- [ ] Implement DDoS protection (Cloudflare/AWS Shield)
- [ ] Regular security audits and updates
- [ ] Monitor for suspicious activities
- [ ] Implement request logging
- [ ] Set up alerts for errors/failures

## Performance Optimization

### Frontend
```bash
# Build optimization
next build

# Enable ISR (Incremental Static Regeneration)
# Configure in next.config.mjs
```

### Backend
- Use connection pooling (already configured with pg Pool)
- Implement caching (Redis)
- Add database indexes (already created)
- Monitor slow queries

### CDN
- Serve static assets from CDN (Vercel, CloudFront)
- Enable compression
- Set appropriate cache headers

## Scaling Strategy

### Vertical Scaling
- Increase server CPU/RAM
- Upgrade database instance size

### Horizontal Scaling
- Load balance across multiple API servers
- Use database read replicas
- Implement caching layer (Redis)

### Database Scaling
- Connection pooling
- Read replicas
- Partitioning for large tables

## Rollback Procedure

```bash
# If deployment fails
git revert <commit-hash>
git push
# Redeploy

# Database rollback (if needed)
psql $DATABASE_URL < /backups/backup-<date>.sql
```

## Monitoring Commands

```bash
# Check API health
curl https://api.your-domain.com/health

# Database connection test
psql $DATABASE_URL -c "SELECT 1"

# Check logs
pm2 logs medical-api
tail -f /var/log/auth.log
```

## Post-Deployment Testing

1. **Authentication Tests**
   - Register new user
   - Login/logout
   - Token expiration

2. **Product Management**
   - Create product (admin)
   - Set pricing (admin)
   - View products (all roles)

3. **Performance Tests**
   - Load testing with k6 or Apache Bench
   - Database query performance
   - API response times

## Support & Maintenance

- Monitor error logs daily
- Review performance metrics weekly
- Security updates: As soon as available
- Feature updates: Scheduled releases
- Database maintenance: Monthly

---

For questions or issues during deployment, contact DevOps team.
