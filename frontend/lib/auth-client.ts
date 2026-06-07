import { authApi } from './api'
import type { LoginRequest, RegisterRequest, LoginResponse, User } from './types'

class AuthClient {
  getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  }
  setToken(t: string) { if (typeof window !== 'undefined') localStorage.setItem('auth_token', t) }
  clearToken() { if (typeof window !== 'undefined') localStorage.removeItem('auth_token') }
  isAuthenticated(): boolean { return this.getToken() !== null }

  async login(data: LoginRequest): Promise<LoginResponse> {
    const result = await authApi.login(data)
    this.setToken(result.token)
    return result
  }
  async register(data: RegisterRequest): Promise<LoginResponse & { pendingApproval?: boolean; message?: string }> {
    const result = await authApi.register(data) as LoginResponse & { pendingApproval?: boolean; message?: string }
    if (result.token) this.setToken(result.token)
    return result
  }
  async getCurrentUser(): Promise<User> { return authApi.me() }
  logout() {
    this.clearToken()
    import('./use-auth').then(m => m.invalidateAuthCache())
  }
}

export const authClient = new AuthClient()
