# Setup & Deployment Checklist

Use this checklist to ensure all components are properly configured before deployment.

## ✅ Initial Setup

- [ ] Clone/download project repository
- [ ] Node.js 18+ installed (`node --version`)
- [ ] pnpm installed (`pnpm --version`)
- [ ] Neon PostgreSQL account created (neon.tech)
- [ ] Database created in Neon

## ✅ Environment Configuration

### Backend Setup
- [ ] Create `backend/.env` file
- [ ] Set `DATABASE_URL` from Neon dashboard
- [ ] Generate `JWT_SECRET` (`openssl rand -base64 32`)
- [ ] Set `PORT=3001` (or desired port)
- [ ] Set `FRONTEND_URL=http://localhost:3000`
- [ ] Set `NODE_ENV=development`
- [ ] **NEVER commit .env files**

### Frontend Setup
- [ ] Create `frontend/.env.local` file
- [ ] Set `NEXT_PUBLIC_API_URL=http://localhost:3001/api`
- [ ] **NEVER commit .env.local files**

## ✅ Dependencies Installation

- [ ] Run `pnpm install` from root directory
- [ ] Verify no errors in installation
- [ ] Check `node_modules` exists
- [ ] Check `pnpm-lock.yaml` generated

## ✅ Database Verification

- [ ] Database schema created (tables exist)
- [ ] Can connect to database: `psql $DATABASE_URL -c "SELECT 1"`
- [ ] All 4 tables created:
  - [ ] users
  - [ ] products
  - [ ] product_pricing
  - [ ] audit_logs
- [ ] Indexes created on all tables
- [ ] Foreign keys configured

## ✅ Frontend Build Verification

- [ ] Run `cd frontend && pnpm build`
- [ ] Build completes without errors
- [ ] All routes are prerendered:
  - [ ] /
  - [ ] /login
  - [ ] /register
  - [ ] /dashboard
  - [ ] /products
  - [ ] /admin/products
  - [ ] /admin/pricing

## ✅ Backend Ready to Run

- [ ] Express server setup complete
- [ ] All routes defined:
  - [ ] POST /api/auth/register
  - [ ] POST /api/auth/login
  - [ ] GET /api/auth/me
  - [ ] GET /api/products
  - [ ] GET /api/products/:id
  - [ ] POST /api/products (admin)
  - [ ] PUT /api/products/:id (admin)
  - [ ] POST /api/products/:id/pricing (admin)
- [ ] Middleware configured (auth, roles)
- [ ] Error handling implemented
- [ ] CORS configured

## ✅ Development Testing

- [ ] Start backend: `cd backend && pnpm dev`
  - [ ] No errors in console
  - [ ] API running on localhost:3001
  - [ ] Health check responds: `curl http://localhost:3001/health`
  
- [ ] Start frontend: `cd frontend && pnpm dev`
  - [ ] No errors in console
  - [ ] App running on localhost:3000
  - [ ] Can access home page
  
- [ ] Authentication Testing:
  - [ ] Can register new account
  - [ ] Can login with registered account
  - [ ] JWT token received and stored
  - [ ] Can view own profile (/auth/me)
  - [ ] Logout clears token
  
- [ ] Authorization Testing:
  - [ ] Non-admin cannot access /admin routes
  - [ ] Non-authenticated redirected to /login
  - [ ] Protected pages require login
  
- [ ] Product Management:
  - [ ] Admin can create products
  - [ ] All roles can view products
  - [ ] Admin can set pricing
  - [ ] Pricing appears when viewing product

## ✅ Security Checklist

### Passwords & Secrets
- [ ] JWT_SECRET is random, 32+ characters
- [ ] No secrets committed to git
- [ ] Password hashing enabled (bcryptjs)
- [ ] Password never logged or exposed

### API Security
- [ ] CORS configured for frontend domain
- [ ] Authorization headers validated
- [ ] Token expiration implemented
- [ ] Rate limiting recommended (not yet implemented)
- [ ] Input validation on all endpoints
- [ ] SQL injection prevented (Drizzle ORM)

### Database Security
- [ ] Credentials in environment variables
- [ ] No database backups in repo
- [ ] Connection pooling enabled (pg Pool)
- [ ] Audit logs tracking changes

### Code Security
- [ ] No secrets in code
- [ ] .gitignore includes .env files
- [ ] TypeScript strict mode enabled
- [ ] No vulnerable dependencies

## ✅ Pre-Deployment

### Code Quality
- [ ] Run linter: `pnpm lint` (both directories)
- [ ] No TypeScript errors: `pnpm tsc --noEmit`
- [ ] Code follows project conventions
- [ ] Comments for complex logic

### Documentation
- [ ] README.md complete
- [ ] API.md documentation updated
- [ ] DEPLOYMENT.md reviewed
- [ ] Inline code comments added where needed

### Performance
- [ ] Frontend build size reasonable
- [ ] API response times acceptable
- [ ] Database queries optimized
- [ ] No console errors in production build

## ✅ Deployment (Vercel)

### Frontend Deployment
- [ ] Create Vercel account
- [ ] Connect GitHub repository
- [ ] Set environment variables:
  - [ ] NEXT_PUBLIC_API_URL
- [ ] Deploy frontend:
  ```bash
  cd frontend && vercel deploy --prod
  ```
- [ ] Verify frontend deployed successfully
- [ ] Custom domain configured (optional)

### Backend Deployment Options

#### Option 1: Vercel Serverless (Recommended)
- [ ] Convert to serverless functions
- [ ] Deploy backend: `cd backend && vercel deploy --prod`
- [ ] Set environment variables in Vercel
- [ ] Test API endpoints

#### Option 2: Traditional Server
- [ ] Choose hosting (AWS, Heroku, DigitalOcean, etc.)
- [ ] Set up server and install Node.js
- [ ] Clone repository
- [ ] Configure environment variables
- [ ] Install dependencies and build
- [ ] Set up PM2 or similar process manager
- [ ] Configure reverse proxy (Nginx)
- [ ] Set up SSL/TLS certificates

#### Option 3: Docker
- [ ] Create Dockerfile for backend
- [ ] Build Docker image
- [ ] Push to registry
- [ ] Deploy to container platform (AWS, GCP, Azure, etc.)

## ✅ Post-Deployment

### Verification
- [ ] Frontend loads without errors
- [ ] Can access login page
- [ ] Can register new account
- [ ] Can login successfully
- [ ] Dashboard displays correctly
- [ ] Admin features work
- [ ] Products display with pricing

### Monitoring
- [ ] Set up error tracking (Sentry recommended)
- [ ] Configure logging
- [ ] Monitor API response times
- [ ] Monitor database performance
- [ ] Set up uptime monitoring

### Backups
- [ ] Database backup strategy implemented
- [ ] Backup schedule configured
- [ ] Tested backup restoration
- [ ] Off-site backup storage

## ✅ Production Configuration

### Environment Variables (Verify Set Correctly)
- [ ] DATABASE_URL is production connection
- [ ] JWT_SECRET is strong (32+ chars)
- [ ] FRONTEND_URL matches deployed frontend
- [ ] NODE_ENV=production
- [ ] No sensitive data in code

### Security Hardening
- [ ] HTTPS/TLS enabled on all endpoints
- [ ] CORS restricted to frontend domain
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] WAF enabled (optional but recommended)
- [ ] DDoS protection configured (Cloudflare, AWS Shield)

### Database
- [ ] Automated backups enabled
- [ ] Backup retention policy set
- [ ] Monitoring and alerts configured
- [ ] Connection pooling optimized
- [ ] Query performance reviewed

## ✅ Ongoing Maintenance

### Regular Tasks
- [ ] Weekly: Check error logs
- [ ] Weekly: Review performance metrics
- [ ] Monthly: Database maintenance
- [ ] Quarterly: Security audit
- [ ] As released: Update dependencies

### Update Schedule
- [ ] Security updates: ASAP
- [ ] Feature updates: Monthly
- [ ] Major versions: Quarterly
- [ ] Dependencies: Monthly

## ✅ Issue Resolution

If issues arise during setup:

1. **Database Connection Error**
   - [ ] Verify DATABASE_URL format
   - [ ] Check PostgreSQL is running
   - [ ] Test connection: `psql $DATABASE_URL`
   - [ ] Review Neon dashboard credentials

2. **Frontend Won't Start**
   - [ ] Check Node.js version (18+)
   - [ ] Delete .next folder and reinstall
   - [ ] Verify API URL set in .env.local
   - [ ] Check port 3000 is available

3. **Backend Won't Start**
   - [ ] Check all dependencies installed
   - [ ] Verify DATABASE_URL set
   - [ ] Check port 3001 is available
   - [ ] Review error in console

4. **Authentication Failing**
   - [ ] Verify JWT_SECRET set correctly
   - [ ] Check token format in header
   - [ ] Verify backend is running
   - [ ] Check CORS configuration

5. **API Not Responding**
   - [ ] Verify backend running
   - [ ] Check API URL in frontend
   - [ ] Review firewall settings
   - [ ] Check CORS headers

## 📋 Final Approval

Before considering the project production-ready:

- [ ] All checklist items completed
- [ ] All tests passing
- [ ] All docs reviewed
- [ ] Team sign-off obtained
- [ ] Deployment authorized
- [ ] Incident response plan ready
- [ ] Support contact info available

---

**Project Status**: Ready for Deployment ✅

For questions, consult the [README.md](./README.md) or [DEPLOYMENT.md](./DEPLOYMENT.md).
