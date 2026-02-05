'use client'

import type { Room } from '@/lib/101/supabase/types'

interface RoomListProps {
  rooms: Room[]
  isLoading: boolean
  onJoin: (roomId: string) => Promise<{ success: boolean; error?: string }>
}

export function RoomList({ rooms, isLoading, onJoin }: RoomListProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12 text-[#a0a0a0]">
        Odalar yükleniyor...
      </div>
    )
  }

  if (rooms.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#a0a0a0] mb-4">Henüz açık oda yok</p>
        <p className="text-sm text-[#a0a0a0]">Yeni bir oda oluşturarak başlayın!</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} onJoin={onJoin} />
      ))}
    </div>
  )
}

interface RoomCardProps {
  room: Room & { host?: { username: string; avatar_url: string | null } }
  onJoin: (roomId: string) => Promise<{ success: boolean; error?: string }>
}

function RoomCard({ room, onJoin }: RoomCardProps) {
  const handleJoin = async () => {
    await onJoin(room.id)
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

  return (
    <div className="room-card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-lg">{room.name}</h3>
          <p className="text-sm text-[#a0a0a0]">
            Kuran: {room.host?.username || 'Bilinmiyor'}
          </p>
        </div>
        <span className={`okey-badge ${statusColors[room.status]}`}>
          {statusText[room.status]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="okey-badge bg-[#3d5a4a] text-[#a0a0a0]">
          {room.is_paired ? 'Eşli' : 'Eşsiz'}
        </span>
        <span className="okey-badge bg-[#3d5a4a] text-[#a0a0a0]">
          {room.is_folding ? 'Katlamalı' : 'Katlamasız'}
        </span>
        <span className="okey-badge bg-[#3d5a4a] text-[#a0a0a0]">
          {room.player_count}/4 Oyuncu
        </span>
      </div>

      <button
        onClick={handleJoin}
        disabled={room.status !== 'waiting' || room.player_count >= 4}
        className="okey-btn okey-btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {room.status === 'waiting' && room.player_count < 4
          ? 'Katıl'
          : room.status === 'playing'
          ? 'Oyunda'
          : 'Dolu'}
      </button>
    </div>
  )
}

