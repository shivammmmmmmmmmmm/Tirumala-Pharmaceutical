# Medical Distribution System

Full-stack medical supply distribution with **MySQL** (XAMPP), role-based access, real orders, credit ledger, and sales commissions.

## Roles

| Role | Who | Capabilities |
|------|-----|----------------|
| **ADMIN** | Company admin | Products, users, sales persons, all orders, commissions, credit limits |
| **SALES_PERSON** | Field sales | Assigned customers, place orders for them, track commissions |
| **USER** | Hospital / clinic / pharmacy / distributor | Browse products, place orders, view ledger |

Public sign-up creates **USER** accounts only (Hospital, Clinic, Pharmacy, Distributor). Admins and sales persons are created by an administrator.

## Prerequisites

- [XAMPP](https://www.apachefriends.org/) with **MySQL** started
- Node.js 18+

## Setup

### 1. Database (XAMPP)

Start **MySQL** in the XAMPP Control Panel.

Optional — run schema manually in phpMyAdmin or:

```bash
cd backend
npm install
npm run db:setup
```

The API also creates tables automatically on first start.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env if your MySQL password is not empty
npm install
npm run dev
```

API: `http://localhost:3001`

### 3. Frontend

```bash
cd frontend
npm install
# .env.local should contain:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev
```

App: `http://localhost:3000`

## First login

On first run the system seeds:

- **Admin:** `admin@medical.com` / `Admin@123`
- 10 sample pharmaceutical products

Change the admin password after first login (`npm run reset-admin` resets it if needed).

## Real-time updates

Order and dashboard pages refresh every **15 seconds** so status changes appear without reloading manually.

## Project structure

```
backend/          Express API + MySQL
frontend/         Next.js UI
backend/database/ SQL schema
```

## Production notes

- Set a strong `JWT_SECRET` in `.env`
- Remove or change the default admin seed
- Use a dedicated MySQL user (not `root` with empty password)
- Deploy API (Railway, Render, VPS) and frontend (Vercel) with `NEXT_PUBLIC_API_URL` pointing to your API
