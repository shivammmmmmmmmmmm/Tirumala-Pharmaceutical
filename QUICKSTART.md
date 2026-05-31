# Quick Start Guide

Get the Medical Product Distribution System running in 5 minutes.

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database (or Neon cloud database)
- pnpm installed (`npm install -g pnpm`)

## Step 1: Clone/Setup Project

```bash
# Navigate to project directory
cd medical-distribution-system
```

## Step 2: Install Dependencies

```bash
# Install all dependencies for frontend, backend, and shared packages
pnpm install
```

## Step 3: Configure Environment Variables

### Frontend Setup
Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Backend Setup
Create `backend/.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/medical_db
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-very-secret-key-at-least-32-characters-long
NODE_ENV=development
```

## Step 4: Set Up Database

The database schema is already created in Neon. If using local PostgreSQL:

```bash
# Create database
createdb medical_db

# The tables are already created via Neon MCP
# If needed, run migration scripts manually
```

## Step 5: Start Development Servers

Open two terminal windows:

**Terminal 1 - Start Backend API:**
```bash
cd backend
pnpm dev
```
Backend will run on `http://localhost:3001`

**Terminal 2 - Start Frontend:**
```bash
cd frontend
pnpm dev
```
Frontend will run on `http://localhost:3000`

## Step 6: Test the Application

1. Open `http://localhost:3000` in your browser
2. Click "Sign up" to create an account
3. Choose a role (try "ADMIN" for full features)
4. Log in with your credentials
5. You're in! Start managing products

## Test Accounts

You can create test accounts during registration. Here are some role-based scenarios to try:

- **ADMIN**: Full access to products and pricing management
- **HOSPITAL**: Can view and purchase products
- **PHARMACY**: Can view and purchase products
- **CLINIC**: Can view and purchase products
- **DISTRIBUTOR**: Can distribute products to other healthcare facilities

## Common Issues

### Backend won't start
```
Error: Cannot find module 'pg'
→ Run: pnpm install in backend/
```

### Frontend won't connect to API
```
Error: Failed to fetch from /api/...
→ Check NEXT_PUBLIC_API_URL is set correctly
→ Ensure backend is running on port 3001
```

### Database connection error
```
Error: could not connect to server
→ Verify DATABASE_URL is correct
→ Ensure PostgreSQL is running
```

### JWT issues
```
Error: Missing authentication token
→ Generate a new JWT_SECRET: openssl rand -base64 32
→ Update in backend/.env
```

## Next Steps

- Read [README.md](./README.md) for detailed documentation
- Check out [schema documentation](#database-schema) for database design
- Explore the `/admin` routes for product management
- Add more products via the admin panel

## Project Structure

```
├── frontend/          # Next.js React app (port 3000)
├── backend/           # Express API server (port 3001)
└── shared/            # Shared TypeScript types
```

## Key Features

✅ Multi-role user system
✅ Product management
✅ Role-based pricing
✅ JWT authentication
✅ Audit logging
✅ Responsive UI
✅ Type-safe API

---

Need help? Check the main [README.md](./README.md) for complete documentation.
