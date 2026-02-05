'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/101/hooks/useAuth'
import { Navbar } from '@/components/101/layout/Navbar'
import { MatchHistory } from '@/components/101/profile/MatchHistory'
import type { Match } from '@/lib/101/supabase/types'

export default function HistoryPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/101/auth/login')
      return
    }

    if (isAuthenticated && user) {
      fetchMatches()
    }
  }, [authLoading, isAuthenticated, user, router])

  const fetchMatches = async () => {
    try {
      setIsLoading(true)
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Oturum bulunamadı')

      const { token } = JSON.parse(sessionData)

      const response = await fetch('/api/101/matches', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Maç geçmişi yüklenemedi')
      }

      setMatches(data.matches)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#d4af37] text-xl">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Maç Geçmişi</h1>
        
        {isLoading ? (
          <div className="text-center text-[#a0a0a0]">Yükleniyor...</div>
        ) : error ? (
          <div className="okey-card text-center">
            <p className="text-[#ef4444]">{error}</p>
          </div>
        ) : (
          <MatchHistory matches={matches} currentUserId={user?.id || ''} />
        )}
      </main>
    </div>
  )
}

