'use client'

import { useEffect, useState } from 'react'
import { ProfileCard } from '@/components/101/profile/ProfileCard'
import { Stats } from '@/components/101/profile/Stats'
import { MatchHistory } from '@/components/101/profile/MatchHistory'
import type { User, Match } from '@/lib/101/supabase/types'

interface ProfileModalProps {
  username: string
  currentUserId: string
  isOwnProfile: boolean
  onClose: () => void
}

export function ProfileModal({ username, currentUserId, isOwnProfile, onClose }: ProfileModalProps) {
  const [profile, setProfile] = useState<User | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [username])

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

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#132f4c] rounded-lg border border-[#1a3a5c] w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1a3a5c] sticky top-0 bg-[#132f4c] z-10">
          <h2 className="font-bold text-lg">Profil</h2>
          <button
            onClick={onClose}
            className="text-[#8899aa] hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-[#ef4444]">{error}</p>
            </div>
          ) : profile ? (
            <div className="space-y-6">
              <ProfileCard
                user={profile}
                isOwnProfile={isOwnProfile}
                onUpdate={fetchProfile}
              />
              <Stats user={profile} />
              <MatchHistory matches={matches} currentUserId={currentUserId} />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-[#8899aa]">Kullanıcı bulunamadı</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

