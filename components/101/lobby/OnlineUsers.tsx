'use client'

import { useEffect, useState, useCallback } from 'react'

interface OnlineUser {
  id: string
  username: string
  avatar_url: string | null
  roomName: string | null
  roomStatus: string | null
}

export function OnlineUsers() {
  const [users, setUsers] = useState<OnlineUser[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/101/users/online')
      const data = await response.json()

      if (response.ok) {
        setUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch online users:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOnlineUsers()
    const interval = setInterval(fetchOnlineUsers, 10000) // Poll every 10 seconds
    return () => clearInterval(interval)
  }, [fetchOnlineUsers])

  return (
    <div className="okey-card">
      <h2 className="font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
        Çevrimiçi
        {users.length > 0 && (
          <span className="text-xs font-normal text-[#8899aa]">({users.length})</span>
        )}
      </h2>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-[#1a3a5c]" />
              <div className="flex-1">
                <div className="h-4 w-20 bg-[#1a3a5c] rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-[#8899aa]">Şu anda çevrimiçi oyuncu yok</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {users.map((user) => (
            <div key={user.id} className="flex items-center gap-2 p-2 rounded hover:bg-[#1a3a5c]/50 transition-colors">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xs font-medium">
                  {user.username[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.username}</p>
                {user.roomName && (
                  <p className="text-xs text-[#8899aa] truncate">
                    {user.roomStatus === 'playing' ? '🎮' : '⏳'} {user.roomName}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
