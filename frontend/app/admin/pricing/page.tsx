'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { productsClient } from '@/lib/products-client'
import { pricingClient } from '@/lib/pricing-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Product, UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['ADMIN', 'SALES_PERSON', 'USER']

interface PricingForm {
  productId: string
  role: UserRole
  price: string
  minQuantity: string
  maxQuantity: string
}

export default function PricingPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<PricingForm>({
    productId: '',
    role: 'USER',
    price: '',
    minQuantity: '1',
    maxQuantity: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const data = await productsClient.getProducts()
        setProducts(data)
      } catch (error) {
        console.error('Error fetching products:', error)
        setError('Failed to load products')
      } finally {
        setLoading(false)
      }
    }

    if (user?.role === 'ADMIN') {
      fetchProducts()
    }
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await pricingClient.createPricing({
        productId: formData.productId,
        role: formData.role,
        price: parseFloat(formData.price),
        minQuantity: parseInt(formData.minQuantity),
        maxQuantity: formData.maxQuantity ? parseInt(formData.maxQuantity) : undefined,
        effectiveFrom: new Date(),
        effectiveTo: undefined,
      })

      setShowForm(false)
      setFormData({
        productId: '',
        role: 'USER',
        price: '',
        minQuantity: '1',
        maxQuantity: '',
      })
      alert('Pricing updated successfully!')
    } catch (err) {
      setError((err as any).message || 'Failed to set pricing')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !user) {
    return null
  }

  if (user.role !== 'ADMIN') {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
        <h1 className="text-xl font-semibold text-gray-900">Manage Pricing</h1>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back
        </Button>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Set Pricing'}
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Set Product Pricing</CardTitle>
              <CardDescription>Define prices by role and quantity</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Product *</label>
                  <select
                    value={formData.productId}
                    onChange={(e) =>
                      setFormData({ ...formData, productId: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select a product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as UserRole,
                        })
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price *</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Min Quantity</label>
                    <Input
                      type="number"
                      value={formData.minQuantity}
                      onChange={(e) =>
                        setFormData({ ...formData, minQuantity: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Quantity</label>
                    <Input
                      type="number"
                      placeholder="No limit"
                      value={formData.maxQuantity}
                      onChange={(e) =>
                        setFormData({ ...formData, maxQuantity: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Setting...' : 'Set Pricing'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600">No products available. Create products first.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {products.map((product) => (
              <Card key={product.id}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900">{product.name}</h3>
                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Click &quot;Set Pricing&quot; to add prices for this product by role.
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
