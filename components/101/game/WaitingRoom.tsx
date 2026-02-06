'use client'

import { useState } from 'react'
import type { Room, RoomPlayer } from '@/lib/101/supabase/types'
import { isBot } from '@/lib/101/game/bot'

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

  const handleAddBot = async () => {
    setIsLoading(true)
    setError('')
    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) {
        setError('Oturum bulunamadı')
        return
      }
      const { token } = JSON.parse(sessionData)

      const res = await fetch(`/api/101/rooms/${room.id}/bot`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Bot eklenemedi')
      }
    } catch (err) {
      console.error('Add bot error:', err)
      setError('Bot eklenirken hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveBot = async (botId: string) => {
    setIsLoading(true)
    setError('')
    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) {
        setError('Oturum bulunamadı')
        return
      }
      const { token } = JSON.parse(sessionData)

      const res = await fetch(`/api/101/rooms/${room.id}/bot`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ botId })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Bot çıkarılamadı')
      }
    } catch (err) {
      console.error('Remove bot error:', err)
      setError('Bot çıkarılırken hata oluştu')
    } finally {
      setIsLoading(false)
    }
  }

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

  // Map seat positions
  const seats = [0, 1, 2, 3].map(position => {
    const player = room.players.find(p => p.seat_position === position)
    return { position, player }
  })

  // Find my seat and calculate relative positions
  const mySeat = currentPlayer?.seat_position ?? 0
  const topSeat = seats[(mySeat + 2) % 4]
  const leftSeat = seats[(mySeat + 3) % 4]
  const rightSeat = seats[(mySeat + 1) % 4]
  const bottomSeat = seats[mySeat]

  const renderSeat = (seat: typeof seats[0], position: 'top' | 'left' | 'right' | 'bottom') => {
    const isMe = seat.player?.user_id === currentUserId

    if (!seat.player) {
      return (
        <div className="waiting-seat flex-col gap-1 px-4 py-3">
          {isHost ? (
            <button
              onClick={handleAddBot}
              disabled={isLoading}
              className="okey-btn okey-btn-secondary text-xs px-3 py-2"
            >
              🤖 Bot Ekle
            </button>
          ) : (
            <>
              <span className="text-[#8899aa] text-sm">Kullanıcı</span>
              <span className="text-[#8899aa] text-sm">Bekleniyor...</span>
            </>
          )}
        </div>
      )
    }

    const p = seat.player
    const playerIsBot = isBot(p.user_id)

    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${p.is_ready
        ? 'border-[#22c55e] bg-[#22c55e]/10'
        : 'border-[#1a3a5c] bg-[#0a1929]'
        } ${isMe ? 'ring-1 ring-[#d4af37]/30' : ''} ${playerIsBot ? 'border-dashed' : ''}`}>
        {playerIsBot ? (
          <div className="w-10 h-10 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xl flex-shrink-0">
            🤖
          </div>
        ) : p.user?.avatar_url ? (
          <img src={p.user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#1a3a5c] flex items-center justify-center text-sm font-medium flex-shrink-0">
            {p.user?.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm flex items-center gap-1 truncate">
            {p.user?.username || 'Oyuncu'}
            {playerIsBot && <span className="text-[10px] text-[#8899aa]">🤖</span>}
            {p.user_id === room.host_id && <span className="text-[10px] text-[#d4af37]">👑</span>}
            {isMe && <span className="text-[10px] text-[#8899aa]">(Sen)</span>}
          </p>
          <p className="text-xs text-[#8899aa]">
            {p.is_ready ? '✓ Hazır' : 'Bekliyor...'}
          </p>
        </div>
        {isHost && playerIsBot && (
          <button
            onClick={() => handleRemoveBot(p.user_id)}
            disabled={isLoading}
            className="text-[#ef4444] hover:text-[#ff6b6b] text-xs flex-shrink-0"
            title="Botu Çıkar"
          >
            ✕
          </button>
        )}
        {room.is_paired && (
          <span className="text-[10px] text-[#8899aa] flex-shrink-0">
            {seat.position % 2 === 0 ? 'A' : 'B'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 okey-table">
      <div className="w-full max-w-2xl">
        {/* Room info */}
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold mb-1">{room.name}</h1>
          <div className="flex justify-center gap-3 text-xs sm:text-sm text-[#8899aa]">
            <span>{room.is_paired ? 'Eşli' : 'Eşsiz'}</span>
            <span>•</span>
            <span>{room.is_folding ? 'Katlamalı' : 'Katlamasız'}</span>
            {room.password && (
              <>
                <span>•</span>
                <span>🔒 Şifreli</span>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-[#ef4444]/20 border border-[#ef4444] rounded-lg p-2 text-[#ef4444] text-xs mb-4 text-center">
            {error}
          </div>
        )}

        {/* Table layout */}
        <div className="relative" style={{ minHeight: 300 }}>
          {/* Table surface */}
          <div className="absolute inset-8 rounded-2xl bg-[#0d2137] border-2 border-[#1a3a5c] shadow-inner" />

          {/* Top player */}
          <div className="flex justify-center mb-2 relative z-10">
            {renderSeat(topSeat, 'top')}
          </div>

          {/* Middle row: left - table - right */}
          <div className="flex items-center justify-between gap-2 relative z-10 my-2">
            <div className="flex-shrink-0 w-48">
              {renderSeat(leftSeat, 'left')}
            </div>

            {/* Center table info */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[#d4af37] text-3xl font-bold mb-1">101</div>
                <div className="text-[#8899aa] text-xs">{room.players.length}/4 Oyuncu</div>
              </div>
            </div>

            <div className="flex-shrink-0 w-48">
              {renderSeat(rightSeat, 'right')}
            </div>
          </div>

          {/* Bottom player (me) */}
          <div className="flex justify-center mt-2 relative z-10">
            {renderSeat(bottomSeat, 'bottom')}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 sm:gap-3 mt-6 justify-center">
          <button onClick={onLeave} className="okey-btn okey-btn-secondary text-xs sm:text-sm" disabled={isLoading}>
            Ayrıl
          </button>
          {isHost ? (
            <button onClick={handleStart} className="okey-btn okey-btn-primary text-xs sm:text-sm" disabled={isLoading || !allPlayersReady}>
              {room.players.length < 4
                ? `${room.players.length}/4 Bekleniyor`
                : allPlayersReady
                  ? 'Oyunu Başlat'
                  : 'Hazır Değil'}
            </button>
          ) : (
            <button
              onClick={handleReady}
              className={`okey-btn text-xs sm:text-sm ${isReady ? 'okey-btn-secondary' : 'okey-btn-primary'}`}
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
