'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/101/hooks/useAuth'
import { Navbar } from '@/components/101/layout/Navbar'
import { ProfileCard } from '@/components/101/profile/ProfileCard'
import { MatchHistory } from '@/components/101/profile/MatchHistory'
import { Stats } from '@/components/101/profile/Stats'
import type { User, Match } from '@/lib/101/supabase/types'

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user: currentUser, isLoading: authLoading, isAuthenticated } = useAuth()
  const [profile, setProfile] = useState<User | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const username = params.username as string
  const isOwnProfile = currentUser?.username === username

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/101/auth/login')
      return
    }

    if (isAuthenticated && username) {
      fetchProfile()
    }
  }, [authLoading, isAuthenticated, username, router])

  const fetchProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/101/profile/${username}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Profil yüklenemedi')
      }

      setProfile(data.user)
      setMatches(data.matches || [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar user={currentUser} />
        <main className="flex-1 flex items-center justify-center">
          <div className="okey-card text-center">
            <p className="text-[#ef4444] mb-4">{error}</p>
            <button
              onClick={() => router.push('/101')}
              className="okey-btn okey-btn-secondary"
            >
              Lobiye Dön
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar user={currentUser} />
        <main className="flex-1 flex items-center justify-center">
          {(authLoading || isLoading) ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="okey-card text-center">
              <p className="text-[#a0a0a0] mb-4">Kullanıcı bulunamadı</p>
              <button
                onClick={() => router.push('/101')}
                className="okey-btn okey-btn-secondary"
              >
                Lobiye Dön
              </button>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={currentUser} />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <ProfileCard
              user={profile}
              isOwnProfile={isOwnProfile}
              onUpdate={fetchProfile}
            />
          </div>
          
          {/* Stats and History */}
          <div className="lg:col-span-2 space-y-8">
            <Stats user={profile} />
            <MatchHistory matches={matches} currentUserId={profile.id} />
          </div>
        </div>
      </main>
    </div>
  )
}

