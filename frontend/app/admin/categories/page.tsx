'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/use-auth'
import { categoriesApi } from '@/lib/api'

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cats, setCats] = useState<{ id: string; name: string }[]>([])
  const [name, setName] = useState('')

  const load = async () => setCats(await categoriesApi.list())

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login')
    else if (user?.role === 'ADMIN') load()
  }, [user, authLoading, router])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    await categoriesApi.create({ name })
    setName('')
    load()
  }

  if (authLoading || !user) return null

  return (
    <div className="contents">
<main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Product Categories</h1>
        <form onSubmit={create} className="flex gap-2 mb-6">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Category name" required className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Add</button>
        </form>
        <ul className="space-y-2">
          {cats.map(c => (
            <li key={c.id} className="bg-white border rounded-lg px-4 py-3 flex justify-between">
              <span>{c.name}</span>
              <button type="button" onClick={() => categoriesApi.delete(c.id).then(load)} className="text-red-600 text-xs">Deactivate</button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
