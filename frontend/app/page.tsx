import LoginPage from './login/page'

export default function HomePage() {
  // Remove client-side auth redirect to avoid redirect/SSR churn and slow clicks.
  // Direct navigation to /admin/products etc. is handled by each protected page.
  return <LoginPage />
}

