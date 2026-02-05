'use client'

import { useState } from 'react'
import type { User } from '@/lib/101/supabase/types'

interface ProfileCardProps {
  user: User
  isOwnProfile: boolean
  onUpdate: () => void
}

export function ProfileCard({ user, isOwnProfile, onUpdate }: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState(user.bio || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setIsLoading(true)
    setError('')

    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Oturum bulunamadı')

      const { token } = JSON.parse(sessionData)

      const response = await fetch('/api/101/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bio })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Güncelleme başarısız')
      }

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const winRate = user.wins + user.losses > 0
    ? Math.round((user.wins / (user.wins + user.losses)) * 100)
    : 0

  return (
    <div className="okey-card">
      {/* Avatar */}
      <div className="flex flex-col items-center mb-6">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="w-24 h-24 rounded-full object-cover border-4 border-[#d4af37]"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-[#1a3a5c] flex items-center justify-center text-3xl font-bold border-4 border-[#d4af37]">
            {user.username[0].toUpperCase()}
          </div>
        )}
        <h1 className="text-xl font-bold mt-4">{user.username}</h1>
        <p className="text-sm text-[#8899aa]">
          Üye: {new Date(user.created_at).toLocaleDateString('tr-TR')}
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 mb-6 text-center">
        <div>
          <p className="text-2xl font-bold text-[#22c55e]">{user.wins}</p>
          <p className="text-xs text-[#8899aa]">Galibiyet</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#ef4444]">{user.losses}</p>
          <p className="text-xs text-[#8899aa]">Mağlubiyet</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-[#d4af37]">{winRate}%</p>
          <p className="text-xs text-[#8899aa]">Kazanma</p>
        </div>
      </div>

      {/* Bio */}
      <div className="border-t border-[#1a3a5c] pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[#8899aa]">Hakkında</h3>
          {isOwnProfile && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-xs text-[#d4af37] hover:underline"
            >
              Düzenle
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-[#ef4444] mb-2">{error}</p>
        )}

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="okey-input resize-none h-24"
              placeholder="Kendinizden bahsedin..."
              maxLength={500}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="okey-btn okey-btn-secondary flex-1 text-sm py-1"
                disabled={isLoading}
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="okey-btn okey-btn-primary flex-1 text-sm py-1"
                disabled={isLoading}
              >
                {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm">
            {user.bio || (isOwnProfile ? 'Henüz bir biyografi eklemediniz.' : 'Biyografi yok.')}
          </p>
        )}
      </div>
    </div>
  )
}

