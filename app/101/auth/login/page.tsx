'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/101/hooks/useAuth'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Kullanıcı adı ve şifre gerekli')
      return
    }

    const result = await login(username, password)
    
    if (result.success) {
      router.push('/101')
    } else {
      setError(result.error || 'Giriş başarısız')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="okey-card w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#d4af37] mb-2">Okey 101</h1>
          <p className="text-[#8899aa]">Hesabınıza giriş yapın</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-[#ef4444]/20 border border-[#ef4444] rounded-lg p-3 text-[#ef4444] text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Kullanıcı Adı</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="okey-input"
              placeholder="Kullanıcı adınız"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="okey-input"
              placeholder="Şifreniz"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="okey-btn okey-btn-primary w-full py-3 disabled:opacity-50"
          >
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-[#8899aa]">
            Hesabınız yok mu?{' '}
            <Link href="/101/auth/register" className="text-[#d4af37] hover:underline">
              Kayıt Ol
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-[#8899aa] hover:text-[#d4af37] text-sm">
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  )
}

