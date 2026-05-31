import { ProductPricing } from './types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

class PricingClient {
  async getPricing(): Promise<ProductPricing[]> {
    const response = await fetch(`${API_URL}/pricing`, { headers: getAuthHeaders() })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch pricing')
    }

    return result.data.data || []
  }

  async createPricing(data: Omit<ProductPricing, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProductPricing> {
    const response = await fetch(`${API_URL}/pricing`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to create pricing')
    }

    return result.data
  }

  async updatePricing(id: string, data: Partial<ProductPricing>): Promise<ProductPricing> {
    const response = await fetch(`${API_URL}/pricing/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to update pricing')
    }

    return result.data
  }

  async deletePricing(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/pricing/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Failed to delete pricing')
    }
  }
}

export const pricingClient = new PricingClient()
