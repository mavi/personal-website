'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Room, RoomPlayer } from '../supabase/types'

interface RoomWithPlayers extends Room {
  players: Array<RoomPlayer & { user?: { username: string; avatar_url: string | null } }>
}

export function useRoom(roomId?: string) {
  const [room, setRoom] = useState<RoomWithPlayers | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeRoom, setActiveRoom] = useState<{ roomId: string; roomName: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all available rooms
  const fetchRooms = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch('/api/101/rooms')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Odalar yüklenemedi')
      }

      // Only update if rooms actually changed (compare by JSON stringification)
      setRooms(prevRooms => {
        const prevJson = JSON.stringify(prevRooms)
        const newJson = JSON.stringify(data.rooms)
        if (prevJson !== newJson) {
          return data.rooms
        }
        return prevRooms
      })

      // Check if user is in an active game (for rejoin)
      const sessionData = localStorage.getItem('okey101_session')
      if (sessionData) {
        const { userId } = JSON.parse(sessionData)
        // Check room_players for this user in a playing room
        for (const room of (data.rooms || [])) {
          if (room.status === 'playing') {
            // We need to check if user is in this room - we'll do this via a separate call
            try {
              const roomRes = await fetch(`/api/101/rooms/${room.id}`)
              if (roomRes.ok) {
                const roomData = await roomRes.json()
                const isInRoom = roomData.room?.players?.some(
                  (p: { user_id: string }) => p.user_id === userId
                )
                if (isInRoom) {
                  setActiveRoom({ roomId: room.id, roomName: room.name })
                  break
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      if (showLoading) {
        setIsLoading(false)
      }
    }
  }, [])

  // Fetch specific room
  const fetchRoom = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/101/rooms/${id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Oda yüklenemedi')
      }

      setRoom(data.room)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Create a new room
  const createRoom = useCallback(async (
    name: string,
    isPaired: boolean,
    isFolding: boolean,
    password?: string
  ) => {
    setIsLoading(true)
    setError(null)

    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Giriş yapmalısınız')

      const { token } = JSON.parse(sessionData)

      const response = await fetch('/api/101/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, isPaired, isFolding, password: password || null })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Oda oluşturulamadı')
      }

      return { success: true, roomId: data.room.id }
    } catch (err) {
      setError((err as Error).message)
      return { success: false, error: (err as Error).message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Join a room
  const joinRoom = useCallback(async (id: string, password?: string) => {
    setError(null)

    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Giriş yapmalısınız')

      const { token } = JSON.parse(sessionData)

      const response = await fetch(`/api/101/rooms/${id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresPassword) {
          return { success: false, error: 'Şifre gerekli', requiresPassword: true }
        }
        throw new Error(data.error || 'Odaya katılınamadı')
      }

      return { success: true }
    } catch (err) {
      setError((err as Error).message)
      return { success: false, error: (err as Error).message }
    }
  }, [])

  // Leave a room
  const leaveRoom = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Giriş yapmalısınız')

      const { token } = JSON.parse(sessionData)

      const response = await fetch(`/api/101/rooms/${id}/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Odadan ayrılınamadı')
      }

      return { success: true }
    } catch (err) {
      setError((err as Error).message)
      return { success: false, error: (err as Error).message }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Set player ready status
  const setReady = useCallback(async (id: string, isReady: boolean) => {
    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Giriş yapmalısınız')

      const { token } = JSON.parse(sessionData)

      const response = await fetch(`/api/101/rooms/${id}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isReady })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Hazır durumu güncellenemedi')
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  // Start the game
  const startGame = useCallback(async (id: string) => {
    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Giriş yapmalısınız')

      const { token } = JSON.parse(sessionData)

      const response = await fetch(`/api/101/game/${id}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Oyun başlatılamadı')
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [])

  // Subscribe to room updates using polling
  useEffect(() => {
    if (!roomId) return

    fetchRoom(roomId)

    const interval = setInterval(() => {
      fetchRoom(roomId)
    }, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [roomId, fetchRoom])

  return {
    room,
    rooms,
    activeRoom,
    isLoading,
    error,
    fetchRooms,
    fetchRoom,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame
  }
}
