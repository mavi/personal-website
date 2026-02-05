'use client'

import { useState } from 'react'
import type { Room } from '@/lib/101/supabase/types'

interface RoomListProps {
  rooms: Room[]
  isLoading: boolean
  onJoin: (roomId: string, password?: string) => Promise<{ success: boolean; error?: string; requiresPassword?: boolean }>
  currentUserId?: string
}

export function RoomList({ rooms, isLoading, onJoin, currentUserId }: RoomListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="room-card animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="h-5 w-32 bg-[#1a3a5c] rounded mb-2" />
                <div className="h-3 w-24 bg-[#1a3a5c] rounded" />
              </div>
              <div className="h-5 w-16 bg-[#1a3a5c] rounded-full" />
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="h-5 w-12 bg-[#1a3a5c] rounded-full" />
              <div className="h-5 w-16 bg-[#1a3a5c] rounded-full" />
            </div>
            <div className="h-9 w-full bg-[#1a3a5c] rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#8899aa] mb-4">Henüz açık oda yok</p>
        <p className="text-sm text-[#8899aa]">Yeni bir oda oluşturarak başlayın!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} onJoin={onJoin} currentUserId={currentUserId} />
      ))}
    </div>
  )
}

interface RoomCardProps {
  room: Room & { host?: { username: string; avatar_url: string | null } }
  onJoin: (roomId: string, password?: string) => Promise<{ success: boolean; error?: string; requiresPassword?: boolean }>
  currentUserId?: string
}

function RoomCard({ room, onJoin, currentUserId }: RoomCardProps) {
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [password, setPassword] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const handleJoin = async () => {
    setIsJoining(true)
    setJoinError('')
    
    const result = await onJoin(room.id, password || undefined)
    
    if (!result.success) {
      if (result.requiresPassword) {
        setShowPasswordInput(true)
        setJoinError('Şifre gerekli')
      } else {
        setJoinError(result.error || 'Katılınamadı')
      }
    }
    setIsJoining(false)
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    handleJoin()
  }

  const statusColors = {
    waiting: 'okey-badge-success',
    playing: 'okey-badge-warning',
    finished: 'okey-badge-error'
  }

  const statusText = {
    waiting: 'Bekliyor',
    playing: 'Oyunda',
    finished: 'Bitti'
  }

  const hasPassword = !!room.password

  return (
    <div className="room-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {hasPassword && <span className="text-[#d4af37]">🔒</span>}
          <div>
            <h3 className="font-medium text-lg">{room.name}</h3>
            <p className="text-sm text-[#8899aa]">
              Kuran: {room.host?.username || 'Bilinmiyor'}
            </p>
          </div>
        </div>
        <span className={`okey-badge ${statusColors[room.status]}`}>
          {statusText[room.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="okey-badge bg-[#1a3a5c] text-[#8899aa]">
          {room.is_paired ? 'Eşli' : 'Eşsiz'}
        </span>
        <span className="okey-badge bg-[#1a3a5c] text-[#8899aa]">
          {room.is_folding ? 'Katlamalı' : 'Katlamasız'}
        </span>
        <span className="okey-badge bg-[#1a3a5c] text-[#8899aa]">
          {room.player_count}/4 Oyuncu
        </span>
      </div>

      {joinError && (
        <p className="text-[#ef4444] text-xs mb-2">{joinError}</p>
      )}

      {showPasswordInput && (
        <form onSubmit={handlePasswordSubmit} className="flex gap-2 mb-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Oda şifresi"
            className="okey-input text-sm py-1.5"
            autoFocus
          />
          <button type="submit" className="okey-btn okey-btn-primary okey-btn-sm" disabled={isJoining}>
            {isJoining ? '...' : 'Gir'}
          </button>
        </form>
      )}

      <button
        onClick={handleJoin}
        disabled={(room.status !== 'waiting' && room.status !== 'playing') || (room.status === 'waiting' && room.player_count >= 4) || isJoining}
        className="okey-btn okey-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {room.status === 'waiting' && room.player_count < 4
          ? (hasPassword && !showPasswordInput ? '🔒 Katıl' : 'Katıl')
          : room.status === 'playing'
          ? 'Devam Et'
          : 'Dolu'}
      </button>
    </div>
  )
}
