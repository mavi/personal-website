'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Tile } from './Tile'
import { TileBack } from './Tile'
import { PlayerHand } from './PlayerHand'
import { DiscardPile } from './DiscardPile'
import { useGameStore } from '@/lib/101/stores/gameStore'
import type { Room, RoomPlayerWithUser, GameStateFromDB } from '@/lib/101/supabase/types'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

interface GameBoardProps {
  room: Room & { players: RoomPlayerWithUser[] }
  gameState: GameStateFromDB
  currentUserId: string
  onLeave?: () => void
}

export function GameBoard({ room, gameState, currentUserId, onLeave }: GameBoardProps) {
  const router = useRouter()
  const { selectedTiles, toggleTileSelection, clearSelection } = useGameStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const hands = gameState.hands as unknown as Record<string, TileType[]>
  const deck = gameState.deck as unknown as TileType[]
  const discardPile = gameState.discard_pile as unknown as TileType[]
  const okeyTile = gameState.okey_tile as unknown as { color: TileColor; number: TileNumber } | null
  const indicatorTile = gameState.indicator_tile as unknown as TileType | null
  const openedSets = gameState.opened_sets as unknown as Array<{ id: string; playerId: string; tiles: TileType[]; type: string }> || []

  const myPlayer = room.players.find(p => p.user_id === currentUserId)
  const mySeat = myPlayer?.seat_position ?? -1
  const myHand = hands[currentUserId] || []
  const isMyTurn = gameState.current_turn === mySeat
  const hasDrawn = gameState.has_drawn

  const getOpponents = useCallback(() => {
    if (mySeat === -1) return []
    const result: Array<{ player: RoomPlayerWithUser | undefined; tileCount: number; isActive: boolean }> = []
    for (let i = 1; i <= 3; i++) {
      const seatIdx = (mySeat + i) % 4
      const player = room.players.find(p => p.seat_position === seatIdx)
      const tileCount = player ? (hands[player.user_id]?.length ?? 0) : 0
      result.push({ player, tileCount, isActive: player ? gameState.current_turn === player.seat_position : false })
    }
    return result
  }, [mySeat, room.players, hands, gameState.current_turn])

  const opponents = getOpponents()

  const getAuthToken = () => {
    const sd = localStorage.getItem('okey101_session')
    if (!sd) throw new Error('Oturum bulunamadı')
    return JSON.parse(sd).token
  }

  const handleDraw = async (source: 'deck' | 'discard') => {
    if (isLoading || !isMyTurn || hasDrawn) return
    setIsLoading(true); setError('')
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/101/game/${room.id}/draw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ source })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Taş çekilemedi')
    } catch (err) { setError((err as Error).message) }
    finally { setIsLoading(false) }
  }

  const handleDiscard = async (tileId: string) => {
    if (isLoading) return
    setIsLoading(true); setError('')
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/101/game/${room.id}/discard`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tileId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Taş atılamadı')
      clearSelection()
    } catch (err) { setError((err as Error).message) }
    finally { setIsLoading(false) }
  }

  const handleOpenSets = async () => {
    if (selectedTiles.length < 3 || isLoading) return
    setIsLoading(true); setError('')
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/101/game/${room.id}/open`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tileIds: selectedTiles })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Per açılamadı')
      clearSelection()
    } catch (err) { setError((err as Error).message) }
    finally { setIsLoading(false) }
  }

  const getPlayerName = (userId: string): string => {
    const p = room.players.find(p => p.user_id === userId)
    return p?.user?.username || 'Oyuncu'
  }

  const currentTurnPlayer = room.players.find(p => p.seat_position === gameState.current_turn)
  const currentTurnName = currentTurnPlayer?.user?.username || 'Oyuncu'

  /* ===================== GAME OVER ===================== */
  if (gameState.game_phase === 'finished') {
    const winnerName = gameState.winner ? getPlayerName(gameState.winner) : '?'
    const isWinner = gameState.winner === currentUserId

    const playerScores = room.players.map(p => {
      const hand = hands[p.user_id] || []
      const isW = p.user_id === gameState.winner
      let hv = 0
      if (!isW) {
        hv = hand.reduce((s: number, t: TileType) => {
          if (t.isJoker) return s + (okeyTile?.number ?? 1)
          if (okeyTile && t.color === okeyTile.color && t.number === okeyTile.number) return s + 25
          return s + t.number
        }, 0)
      }
      const mul = (gameState.finish_type && gameState.finish_type !== 'normal' && !isW) ? 2 : 1
      return { userId: p.user_id, name: p.user?.username || 'Oyuncu', handValue: hv, multiplier: mul, finalScore: hv * mul, isWinner: isW }
    }).sort((a, b) => a.finalScore - b.finalScore)

    const fl: Record<string, string> = { normal: 'Normal Bitiş', okey: 'Okey Bitiş (x2)', elden: 'Elden Bitiş (x2)', yedi_cift: '7 Çift (x2)' }

    return (
      <div className="flex-1 flex items-center justify-center p-3">
        <div className="okey-card w-full max-w-sm text-center">
          <h2 className="text-xl font-bold text-[#d4af37] mb-1">Oyun Bitti!</h2>
          <p className="mb-1 text-sm">
            {isWinner
              ? <span className="text-[#22c55e] font-bold">Kazandınız! 🏆</span>
              : <span className="text-[#a0a0a0]">Kazanan: <span className="text-white font-medium">{winnerName}</span></span>}
          </p>
          <p className="text-xs text-[#a0a0a0] mb-3">{fl[gameState.finish_type || 'normal']}</p>

          <div className="mb-4 text-left">
            <div className="grid grid-cols-4 text-[10px] text-[#a0a0a0] border-b border-[#3d5a4a] pb-1 mb-1">
              <span>Oyuncu</span><span className="text-center">El</span><span className="text-center">×</span><span className="text-right">Puan</span>
            </div>
            {playerScores.map(ps => (
              <div key={ps.userId} className={`grid grid-cols-4 py-1 text-xs rounded ${ps.userId === currentUserId ? 'bg-[#d4af37]/10' : ''} ${ps.isWinner ? 'text-[#22c55e]' : ''}`}>
                <span className="font-medium truncate">{ps.isWinner ? '🏆' : ''}{ps.name}</span>
                <span className="text-center">{ps.handValue}</span>
                <span className="text-center">{ps.multiplier > 1 ? `x${ps.multiplier}` : '-'}</span>
                <span className="text-right font-bold">{ps.finalScore}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/101')} className="okey-btn okey-btn-primary w-full py-2">Lobiye Dön</button>
        </div>
      </div>
    )
  }

  /* ===================== PLAYING ===================== */
  return (
    <div className="flex-1 flex flex-col okey-table safe-bottom overflow-hidden">
      {/* Error bar */}
      {error && (
        <div className="bg-[#ef4444]/20 border-b border-[#ef4444] px-3 py-1 text-[#ef4444] text-[11px] text-center flex-shrink-0">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">×</button>
        </div>
      )}

      {/* Top bar: info + turn + back button (for mobile landscape) */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#1a2f23]/80 text-[11px] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {onLeave && (
            <button onClick={onLeave} className="text-[#a0a0a0] hover:text-[#d4af37] mr-1 flex-shrink-0">←</button>
          )}
          <span className="text-[#a0a0a0]">{deck.length}</span>
          {indicatorTile && <Tile tile={indicatorTile} size="small" />}
          {okeyTile && (
            <span className="text-[#d4af37] font-medium">
              O:{okeyTile.number}
            </span>
          )}
        </div>
        {/* Opponents strip */}
        <div className="flex items-center gap-1 overflow-x-auto flex-shrink-0 mx-2">
          {opponents.map((opp, i) => (
            <div key={i} className="opponent-compact">
              {opp.isActive && <div className="opponent-active" />}
              <span className="opponent-name">{opp.player?.user?.username || '-'}</span>
              <span className="opponent-count">{opp.tileCount}</span>
            </div>
          ))}
        </div>
        <div className={`px-2 py-0.5 rounded-full flex-shrink-0 text-[11px] ${isMyTurn ? 'bg-[#22c55e]/20 text-[#22c55e] animate-pulse' : 'bg-[#3d5a4a] text-[#a0a0a0]'}`}>
          {isMyTurn ? (hasDrawn ? 'At' : 'Çek') : currentTurnName}
        </div>
      </div>

      {/* Center: Deck + Discard + Opened Sets */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 px-2 min-h-0 overflow-y-auto">
        <div className="flex items-center gap-4">
          {/* Deck */}
          <button
            className={`flex flex-col items-center transition-transform ${isMyTurn && !hasDrawn && !isLoading ? 'active:scale-95' : 'opacity-40 pointer-events-none'}`}
            onClick={() => handleDraw('deck')}
            disabled={!isMyTurn || hasDrawn || isLoading}
          >
            <div className="w-9 h-12 rounded bg-gradient-to-br from-[#d4af37] to-[#b8960f] flex items-center justify-center shadow-lg">
              <span className="text-[#1a2f23] font-bold text-[10px]">{deck.length}</span>
            </div>
            <span className="text-[9px] text-[#a0a0a0] mt-0.5">Deste</span>
          </button>

          {/* Discard */}
          <DiscardPile tiles={discardPile} canDraw={isMyTurn && !hasDrawn && !isLoading && discardPile.length > 0} onDraw={() => handleDraw('discard')} />
        </div>

        {/* Opened sets */}
        {openedSets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center max-w-full px-1 mt-1">
            {openedSets.map(set => (
              <div key={set.id} className="flex gap-px bg-[#1a2f23]/60 rounded p-0.5">
                {set.tiles.map((tile: TileType) => (
                  <Tile key={tile.id} tile={tile} size="small" okeyTile={okeyTile} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Player hand + controls pinned to bottom */}
      <div className="flex-shrink-0">
        <PlayerHand tiles={myHand} selectedTiles={selectedTiles} onTileClick={toggleTileSelection} okeyTile={okeyTile} isMyTurn={isMyTurn} />

        {/* Action buttons */}
        {isMyTurn && hasDrawn && selectedTiles.length > 0 && (
          <div className="flex justify-center gap-1.5 px-2 py-1">
            {selectedTiles.length === 1 && (
              <button onClick={() => handleDiscard(selectedTiles[0])} disabled={isLoading} className="okey-btn okey-btn-danger okey-btn-sm">
                {isLoading ? '...' : 'At'}
              </button>
            )}
            {selectedTiles.length >= 3 && (
              <button onClick={handleOpenSets} disabled={isLoading} className="okey-btn okey-btn-primary okey-btn-sm">
                {isLoading ? '...' : `Per Aç (${selectedTiles.length})`}
              </button>
            )}
            <button onClick={clearSelection} className="okey-btn okey-btn-secondary okey-btn-sm">Temizle</button>
          </div>
        )}
      </div>
    </div>
  )
}
