'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/101/hooks/useAuth'
import { useRoom } from '@/lib/101/hooks/useRoom'
import { Navbar } from '@/components/101/layout/Navbar'
import { RoomList } from '@/components/101/lobby/RoomList'
import { CreateRoomModal } from '@/components/101/lobby/CreateRoomModal'
import { OnlineUsers } from '@/components/101/lobby/OnlineUsers'

export default function LobbyPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { rooms, isLoading: roomsLoading, fetchRooms, createRoom, joinRoom } = useRoom()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/101/auth/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      fetchRooms()
      // Refresh rooms every 5 seconds
      const interval = setInterval(fetchRooms, 5000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, fetchRooms])

  const handleCreateRoom = async (name: string, isPaired: boolean, isFolding: boolean) => {
    const result = await createRoom(name, isPaired, isFolding)
    if (result.success && result.roomId) {
      setIsCreateModalOpen(false)
      router.push(`/101/room/${result.roomId}`)
    }
    return result
  }

  const handleJoinRoom = async (roomId: string) => {
    const result = await joinRoom(roomId)
    if (result.success) {
      router.push(`/101/room/${roomId}`)
    }
    return result
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
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Açık Odalar</h1>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="okey-btn okey-btn-primary"
              >
                Oda Oluştur
              </button>
            </div>
            
            <RoomList
              rooms={rooms}
              isLoading={roomsLoading}
              onJoin={handleJoinRoom}
            />
          </div>
          
          {/* Sidebar */}
          <div className="w-full lg:w-80">
            <OnlineUsers />
          </div>
        </div>
      </main>
      
      {isCreateModalOpen && (
        <CreateRoomModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  )
}

