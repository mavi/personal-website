'use client'

import { useState } from 'react'
import type { Room, RoomPlayer } from '@/lib/101/supabase/types'

interface WaitingRoomProps {
  room: Room & { players: Array<RoomPlayer & { user?: { username: string; avatar_url: string | null } }> }
  currentUserId: string
  isHost: boolean
  onReady: (isReady: boolean) => Promise<{ success: boolean; error?: string }>
  onStart: () => Promise<{ success: boolean; error?: string }>
  onLeave: () => Promise<void>
}

export function WaitingRoom({ room, currentUserId, isHost, onReady, onStart, onLeave }: WaitingRoomProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const currentPlayer = room.players.find(p => p.user_id === currentUserId)
  const isReady = currentPlayer?.is_ready || false
  const allPlayersReady = room.players.length === 4 && room.players.every(p => p.is_ready || p.user_id === room.host_id)

  const handleReady = async () => {
    setIsLoading(true)
    setError('')
    const result = await onReady(!isReady)
    if (!result.success) setError(result.error || 'Hata oluştu')
    setIsLoading(false)
  }

  const handleStart = async () => {
    setIsLoading(true)
    setError('')
    const result = await onStart()
    if (!result.success) setError(result.error || 'Oyun başlatılamadı')
    setIsLoading(false)
  }

  const seats = [0, 1, 2, 3].map(position => {
    const player = room.players.find(p => p.seat_position === position)
    return { position, player }
  })

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6">
      <div className="okey-card w-full max-w-lg">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold mb-1">{room.name}</h1>
          <div className="flex justify-center gap-3 text-xs sm:text-sm text-[#a0a0a0]">
            <span>{room.is_paired ? 'Eşli' : 'Eşsiz'}</span>
            <span>•</span>
            <span>{room.is_folding ? 'Katlamalı' : 'Katlamasız'}</span>
          </div>
        </div>

        {error && (
          <div className="bg-[#ef4444]/20 border border-[#ef4444] rounded-lg p-2 text-[#ef4444] text-xs mb-4 text-center">
            {error}
          </div>
        )}

        {/* Seats grid — 2 cols on wider, 1 col on very narrow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-6">
          {seats.map(({ position, player }) => (
            <div
              key={position}
              className={`p-3 rounded-lg border-2 transition-all ${
                player
                  ? player.is_ready
                    ? 'border-[#22c55e] bg-[#22c55e]/10'
                    : 'border-[#3d5a4a] bg-[#1a2f23]'
                  : 'border-dashed border-[#3d5a4a] bg-[#1a2f23]/50'
              }`}
            >
              {player ? (
                <div className="flex items-center gap-2">
                  {player.user?.avatar_url ? (
                    <img src={player.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#3d5a4a] flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {player.user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm flex items-center gap-1 truncate">
                      {player.user?.username || 'Oyuncu'}
                      {player.user_id === room.host_id && <span className="text-[10px] text-[#d4af37]">👑</span>}
                    </p>
                    <p className="text-xs text-[#a0a0a0]">
                      {player.is_ready ? '✓ Hazır' : 'Bekliyor...'}
                    </p>
                  </div>
                  {room.is_paired && (
                    <span className="text-[10px] text-[#a0a0a0] flex-shrink-0">
                      {position % 2 === 0 ? 'A' : 'B'}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-8 text-[#a0a0a0] text-xs">
                  Boş Koltuk
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 sm:gap-3">
          <button onClick={onLeave} className="okey-btn okey-btn-secondary flex-1 text-xs sm:text-sm" disabled={isLoading}>
            Ayrıl
          </button>
          {isHost ? (
            <button onClick={handleStart} className="okey-btn okey-btn-primary flex-1 text-xs sm:text-sm" disabled={isLoading || !allPlayersReady}>
              {room.players.length < 4
                ? `${room.players.length}/4`
                : allPlayersReady
                ? 'Başlat'
                : 'Hazır Değil'}
            </button>
          ) : (
            <button
              onClick={handleReady}
              className={`okey-btn flex-1 text-xs sm:text-sm ${isReady ? 'okey-btn-secondary' : 'okey-btn-primary'}`}
              disabled={isLoading}
            >
              {isReady ? 'Hazır Değilim' : 'Hazırım'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
