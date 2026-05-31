# API Documentation

Complete REST API reference for the Medical Product Distribution System.

## Base URL

```
Development: http://localhost:3001/api
Production: https://api.your-domain.com/api
```

## Authentication

All endpoints except `/auth/register` and `/auth/login` require JWT authentication.

Include token in header:
```
Authorization: Bearer <jwt_token>
```

### Get JWT Token

Login and receive token in response:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "ADMIN",
      "organizationName": "Hospital",
      "isActive": true,
      "createdAt": "2024-05-30T10:00:00Z",
      "updatedAt": "2024-05-30T10:00:00Z"
    }
  }
}
```

## Authentication Endpoints

### POST /auth/register
Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe",
  "role": "PHARMACY",
  "organizationName": "City Pharmacy"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | ✓ | Email address (must be unique) |
| password | string | ✓ | Password (min 8 chars recommended) |
| name | string | ✓ | Full name |
| role | string | ✓ | ADMIN, DISTRIBUTOR, HOSPITAL, CLINIC, PHARMACY |
| organizationName | string | | Organization/facility name |

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { /* user object */ }
  }
}
```

**Status Codes:**
- 201: Created successfully
- 400: Missing required fields
- 409: User already exists

---

### POST /auth/login
Sign in with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as register (200 status)

**Status Codes:**
- 200: Login successful
- 400: Missing email or password
- 401: Invalid credentials

---

### GET /auth/me
Get current authenticated user info.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "ADMIN",
    "organizationName": "Hospital",
    "isActive": true,
    "createdAt": "2024-05-30T10:00:00Z",
    "updatedAt": "2024-05-30T10:00:00Z"
  }
}
```

**Status Codes:**
- 200: Success
- 401: Not authenticated
- 404: User not found

---

## Product Endpoints

### GET /products
List all active products with pagination.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | integer | 1 | Page number |
| pageSize | integer | 10 | Items per page |
| category | string | | Filter by category |
| search | string | | Search product name |

**Example:**
```bash
curl http://localhost:3001/api/products?page=1&pageSize=20 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "Surgical Gloves",
        "description": "Sterile surgical gloves",
        "sku": "GLV-001",
        "category": "PPE",
        "manufacturer": "MedCorp",
        "quantity": 500,
        "reorderLevel": 100,
        "isActive": true,
        "createdAt": "2024-05-30T10:00:00Z",
        "updatedAt": "2024-05-30T10:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

**Status Codes:**
- 200: Success
- 401: Not authenticated
- 500: Server error

---

### GET /products/:id
Get product details with pricing for user's role.

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | uuid | Product ID |

**Example:**
```bash
curl http://localhost:3001/api/products/abc-123 \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Surgical Gloves",
    "description": "Sterile surgical gloves",
    "sku": "GLV-001",
    "category": "PPE",
    "manufacturer": "MedCorp",
    "quantity": 500,
    "reorderLevel": 100,
    "isActive": true,
    "createdAt": "2024-05-30T10:00:00Z",
    "updatedAt": "2024-05-30T10:00:00Z",
    "pricing": {
      "id": "uuid",
      "productId": "uuid",
      "role": "HOSPITAL",
      "price": "2.50",
      "minQuantity": 100,
      "maxQuantity": null,
      "effectiveFrom": "2024-05-30T10:00:00Z",
      "effectiveTo": null,
      "createdAt": "2024-05-30T10:00:00Z"
    }
  }
}
```

**Status Codes:**
- 200: Success
- 401: Not authenticated
- 404: Product not found

---

### POST /products (ADMIN only)
Create a new product.

**Request:**
```json
{
  "name": "Surgical Gloves",
  "description": "Sterile surgical gloves",
  "sku": "GLV-001",
  "category": "PPE",
  "manufacturer": "MedCorp",
  "reorderLevel": 100
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | ✓ | Product name |
| sku | string | ✓ | SKU (must be unique) |
| description | string | | Product description |
| category | string | | Product category |
| manufacturer | string | | Manufacturer name |
| reorderLevel | integer | | Stock level to trigger reorder |

**Response:**
```json
{
  "success": true,
  "data": { /* product object */ }
}
```

**Status Codes:**
- 201: Created successfully
- 400: Missing required fields
- 401: Not authenticated
- 403: Insufficient permissions
- 409: SKU already exists

---

### PUT /products/:id (ADMIN only)
Update product details.

**Request:**
```json
{
  "name": "Updated Name",
  "quantity": 600,
  "isActive": true
}
```

**Parameters:** Any product field can be updated

**Response:** Updated product object

**Status Codes:**
- 200: Updated successfully
- 401: Not authenticated
- 403: Insufficient permissions
- 404: Product not found

---

### POST /products/:id/pricing (ADMIN only)
Set product pricing for a specific role.

**Request:**
```json
{
  "role": "HOSPITAL",
  "price": "2.50",
  "minQuantity": 100,
  "maxQuantity": 1000
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| role | string | ✓ | ADMIN, DISTRIBUTOR, HOSPITAL, CLINIC, PHARMACY |
| price | decimal | ✓ | Price per unit |
| minQuantity | integer | | Minimum order quantity |
| maxQuantity | integer | | Maximum order quantity |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "productId": "uuid",
    "role": "HOSPITAL",
    "price": "2.50",
    "minQuantity": 100,
    "maxQuantity": 1000,
    "effectiveFrom": "2024-05-30T10:00:00Z",
    "effectiveTo": null,
    "createdAt": "2024-05-30T10:00:00Z"
  }
}
```

**Status Codes:**
- 201: Pricing set successfully
- 400: Missing required fields
- 401: Not authenticated
- 403: Insufficient permissions
- 404: Product not found

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error description"
}
```

### Common Error Codes

| Code | Message | Cause |
|------|---------|-------|
| 400 | Missing required fields | Invalid request data |
| 401 | Missing authentication token | No token provided |
| 401 | Invalid or expired token | Token invalid/expired |
| 403 | Insufficient permissions | User role not allowed |
| 404 | Product not found | Invalid product ID |
| 409 | User already exists | Email duplicate |
| 500 | Internal server error | Server error |

---

## Rate Limiting (Recommended)

Production should implement rate limiting. Example with express-rate-limit:

```
100 requests per 15 minutes per IP
200 requests per 15 minutes per authenticated user
```

---

## Testing with cURL

### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "PHARMACY"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Get Products (with token)
```bash
curl http://localhost:3001/api/products \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Create Product (Admin)
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "name": "Surgical Masks",
    "sku": "MSK-001",
    "category": "PPE",
    "manufacturer": "SafeCorp"
  }'
```

---

## Webhook Events (Coming Soon)

Future versions will support webhooks for:
- Product created/updated
- Pricing changed
- Stock below reorder level
- User role changed

---

## API Versioning

Current version: v1 (part of `/api` prefix)

Future: `/api/v2` will be introduced with major breaking changes.

---

For questions or API issues, check the [README.md](./README.md) or contact support.
