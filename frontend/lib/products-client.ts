import { Product } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

class ProductsClient {
  async getProducts(params?: { search?: string; category?: string; page?: number; pageSize?: number }): Promise<Product[]> {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.category) query.set('category', params.category)
    if (params?.page) query.set('page', String(params.page))
    if (params?.pageSize) query.set('pageSize', String(params.pageSize))

    const url = `${API_URL}/products${query.toString() ? `?${query}` : ''}`
    const response = await fetch(url, { headers: getAuthHeaders() })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch products')
    }

    return result.data.data || []
  }

  async getProduct(id: string): Promise<Product> {
    const response = await fetch(`${API_URL}/products/${id}`, { headers: getAuthHeaders() })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Product not found')
    }

    return result.data
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const response = await fetch(`${API_URL}/products`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create product')
    }

    return result.data
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update product')
    }

    return result.data
  }

  async deleteProduct(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to delete product')
    }
  }
}

export const productsClient = new ProductsClient()
