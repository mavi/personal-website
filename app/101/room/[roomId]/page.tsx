'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/101/hooks/useAuth'
import { useRoom } from '@/lib/101/hooks/useRoom'
import { Navbar } from '@/components/101/layout/Navbar'
import { WaitingRoom } from '@/components/101/game/WaitingRoom'
import { GameBoard } from '@/components/101/game/GameBoard'
import { ChatBox } from '@/components/101/chat/ChatBox'
import { ProfileModal } from '@/components/101/modals/ProfileModal'
import { HistoryModal } from '@/components/101/modals/HistoryModal'
import { createClient } from '@/lib/101/supabase/client'
import type { GameStateFromDB } from '@/lib/101/supabase/types'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024 && 'ontouchstart' in window)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    const check = () => setIsPortrait(window.innerHeight > window.innerWidth)
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])
  return isPortrait
}

export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { room, isLoading: roomLoading, leaveRoom, setReady, startGame } = useRoom(roomId)
  const [gameState, setGameState] = useState<GameStateFromDB | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orientationLocked, setOrientationLocked] = useState(false)

  const supabaseRef = useRef(createClient())
  const isMobile = useIsMobile()
  const isPortrait = useIsPortrait()

  // Whether we need to apply the CSS rotation hack (mobile + portrait + lock failed)
  const needsCSSRotation = isMobile && isPortrait && !orientationLocked

  // Attempt to lock orientation to landscape on mobile
  useEffect(() => {
    if (!isMobile) return

    let locked = false

    const tryLock = async () => {
      try {
        // Try the Screen Orientation API (not typed in all TS libs)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orientation = screen.orientation as any
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape')
          locked = true
          setOrientationLocked(true)
        }
      } catch {
        // Lock not supported or denied — we'll use CSS rotation fallback
        setOrientationLocked(false)
      }
    }

    tryLock()

    return () => {
      if (locked) {
        try {
          screen.orientation.unlock()
        } catch {
          // ignore
        }
      }
    }
  }, [isMobile])

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/101/auth/login')
    }
  }, [authLoading, isAuthenticated, router])

  // Heartbeat: keep server aware we're connected
  useEffect(() => {
    if (!roomId || !isAuthenticated) return

    const sendHeartbeat = async () => {
      try {
        const sessionData = localStorage.getItem('okey101_session')
        if (!sessionData) return
        const { token } = JSON.parse(sessionData)
        await fetch(`/api/101/rooms/${roomId}/heartbeat`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      } catch {
        // ignore heartbeat failures
      }
    }

    sendHeartbeat()
    const heartbeatInterval = setInterval(sendHeartbeat, 5000)

    return () => clearInterval(heartbeatInterval)
  }, [roomId, isAuthenticated])

  // Subscribe to game state changes
  useEffect(() => {
    if (!roomId || !isAuthenticated) return

    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`game:${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_states', filter: `room_id=eq.${roomId}` },
        async () => {
          const res = await fetch(`/api/101/game/${roomId}`)
          if (res.ok) {
            const data = await res.json()
            if (data.gameState) setGameState(data.gameState)
          }
        }
      )
      .subscribe()

    fetchGameState()
    const interval = setInterval(fetchGameState, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isAuthenticated])

  const fetchGameState = async () => {
    try {
      const res = await fetch(`/api/101/game/${roomId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.gameState) setGameState(data.gameState)
      }
    } catch (err) {
      console.error('Failed to fetch game state:', err)
    }
  }

  const handleLeave = useCallback(async () => {
    const result = await leaveRoom(roomId)
    if (result.success) router.push('/101')
    else setError(result.error || 'Odadan ayrılınamadı')
  }, [leaveRoom, roomId, router])

  const handleReady = useCallback(async (isReady: boolean): Promise<{ success: boolean; error?: string }> => {
    const result = await setReady(roomId, isReady)
    if (!result.success) setError(result.error || 'Hazır durumu güncellenemedi')
    return result
  }, [setReady, roomId])

  const handleStartGame = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    const result = await startGame(roomId)
    if (!result.success) setError(result.error || 'Oyun başlatılamadı')
    return result
  }, [startGame, roomId])

  // Room loading or not found
  if (!room) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a1929]">
        <Navbar user={user} />
        <main className="flex-1 flex items-center justify-center p-4">
          {(authLoading || roomLoading) ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="okey-card text-center">
              <p className="text-[#8899aa] mb-4">Oda bulunamadı</p>
              <button onClick={() => router.push('/101')} className="okey-btn okey-btn-secondary">
                Lobiye Dön
              </button>
            </div>
          )}
        </main>
      </div>
    )
  }

  const isHost = room.host_id === user?.id
  const isPlaying = room.status === 'playing'

  // The inner room content
  const roomContent = (
    <>
      {/* Navbar: hide on mobile landscape when game is active */}
      <div className={isPlaying && isMobile ? 'landscape-hide' : ''}>
        <Navbar
          user={user}
          showBackButton
          onBack={handleLeave}
          inGame={isPlaying}
          onShowProfile={() => setShowProfileModal(true)}
          onShowHistory={() => setShowHistoryModal(true)}
        />
      </div>

      {error && (
        <div className="bg-[#ef4444]/20 border-b border-[#ef4444] px-3 py-2 text-center text-[#ef4444] text-xs">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">×</button>
        </div>
      )}

      <main className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          {isPlaying && gameState ? (
            <GameBoard
              room={room}
              gameState={gameState}
              currentUserId={user?.id || ''}
              onLeave={handleLeave}
            />
          ) : (
            <WaitingRoom
              room={room}
              currentUserId={user?.id || ''}
              isHost={isHost}
              onReady={handleReady}
              onStart={handleStartGame}
              onLeave={handleLeave}
            />
          )}
        </div>

        {/* Chat sidebar - desktop only */}
        <div className="w-72 border-l border-[#1a3a5c] hidden lg:block">
          <ChatBox roomId={roomId} userId={user?.id || ''} username={user?.username || ''} />
        </div>

        {/* Chat FAB - mobile (only when game NOT playing, or always on waiting) */}
        {(!isPlaying || !isMobile) && (
          <button
            onClick={() => setShowChat(!showChat)}
            className="lg:hidden fixed bottom-3 right-3 z-40 okey-btn okey-btn-primary rounded-full w-11 h-11 flex items-center justify-center shadow-lg text-lg"
          >
            💬
          </button>
        )}

        {/* Chat overlay - mobile */}
        {showChat && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowChat(false)}>
            <div
              className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-[#132f4c] border-l border-[#1a3a5c]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-3 border-b border-[#1a3a5c]">
                <span className="font-medium">Sohbet</span>
                <button onClick={() => setShowChat(false)} className="text-[#8899aa] hover:text-white text-xl">×</button>
              </div>
              <div style={{ height: 'calc(100% - 48px)' }}>
                <ChatBox roomId={roomId} userId={user?.id || ''} username={user?.username || ''} />
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )

  // Wrap in force-landscape CSS rotation if needed
  return (
    <div className={`flex flex-col room-enter ${needsCSSRotation ? 'force-landscape' : 'min-h-screen'}`}>
      {/* If CSS-rotated, add a back button overlay since navbar is rotated away */}
      {needsCSSRotation && isPlaying && (
        <button
          onClick={handleLeave}
          className="fixed top-2 left-2 z-[10000] text-[#8899aa] bg-[#132f4c]/90 rounded-full w-8 h-8 flex items-center justify-center text-sm border border-[#1a3a5c]"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
        >
          ←
        </button>
      )}
      {roomContent}

      {/* In-game modals */}
      {showProfileModal && user && (
        <ProfileModal
          username={user.username}
          currentUserId={user.id}
          isOwnProfile={true}
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showHistoryModal && user && (
        <HistoryModal
          currentUserId={user.id}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  )
}
