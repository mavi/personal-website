'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Tile, TileBack } from './Tile'
import { PlayerHand } from './PlayerHand'
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

interface OpenedSetData {
  id: string
  playerId: string
  tiles: TileType[]
  type: string
}

export function GameBoard({ room, gameState, currentUserId, onLeave }: GameBoardProps) {
  const router = useRouter()
  const { selectedTiles, toggleTileSelection, clearSelection } = useGameStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const hands = gameState.hands as unknown as Record<string, TileType[]>
  const deck = gameState.deck as unknown as TileType[]
  const playerDiscards = gameState.player_discards as unknown as Record<string, TileType | null>
  const okeyTile = gameState.okey_tile as unknown as { color: TileColor; number: TileNumber } | null
  const indicatorTile = gameState.indicator_tile as unknown as TileType | null
  const openedSets = (gameState.opened_sets as unknown as OpenedSetData[]) || []

  const myPlayer = room.players.find(p => p.user_id === currentUserId)
  const mySeat = myPlayer?.seat_position ?? -1
  const myHand = hands[currentUserId] || []
  const isMyTurn = gameState.current_turn === mySeat
  const hasDrawn = gameState.has_drawn

  // Get opponents in relative positions: left, top, right
  const getRelativePlayers = useCallback(() => {
    if (mySeat === -1) return { left: undefined, top: undefined, right: undefined }
    
    const leftSeat = (mySeat + 3) % 4
    const topSeat = (mySeat + 2) % 4
    const rightSeat = (mySeat + 1) % 4

    return {
      left: room.players.find(p => p.seat_position === leftSeat),
      top: room.players.find(p => p.seat_position === topSeat),
      right: room.players.find(p => p.seat_position === rightSeat),
      leftSeat,
      topSeat,
      rightSeat
    }
  }, [mySeat, room.players])

  const { left: leftPlayer, top: topPlayer, right: rightPlayer, leftSeat, topSeat, rightSeat } = getRelativePlayers()

  // Left discard = tile from left player (I can draw this)
  const leftDiscardTile = leftSeat !== undefined ? playerDiscards[leftSeat.toString()] : null
  // Right discard = my own discard tile (visible to right player)
  const myDiscardTile = playerDiscards[mySeat.toString()] ?? null

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

  const handleAddToSet = async (tileId: string, setId: string) => {
    if (isLoading) return
    setIsLoading(true); setError('')
    try {
      const token = getAuthToken()
      const res = await fetch(`/api/101/game/${room.id}/add-to-set`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tileId, setId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Taş eklenemedi')
      clearSelection()
    } catch (err) { setError((err as Error).message) }
    finally { setIsLoading(false) }
  }

  // Handle drop on discard area
  const handleDiscardDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const tileId = e.dataTransfer.getData('text/plain')
    if (tileId && isMyTurn && hasDrawn) {
      handleDiscard(tileId)
    }
  }, [isMyTurn, hasDrawn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle drop on opened set
  const handleSetDrop = useCallback((e: React.DragEvent, setId: string) => {
    e.preventDefault()
    const tileId = e.dataTransfer.getData('text/plain')
    if (tileId && isMyTurn) {
      handleAddToSet(tileId, setId)
    }
  }, [isMyTurn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle drop on deck (draw)
  const handleDeckDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    // This is for when we're drawing, not dropping
  }, [])

  const getPlayerName = (userId: string): string => {
    const p = room.players.find(p => p.user_id === userId)
    return p?.user?.username || 'Oyuncu'
  }

  const getPlayerTileCount = (player: RoomPlayerWithUser | undefined) => {
    if (!player) return 0
    return hands[player.user_id]?.length ?? 0
  }

  // Group opened sets by player
  const setsByPlayer = useMemo(() => {
    const groups: Record<string, OpenedSetData[]> = {}
    for (const set of openedSets) {
      if (!groups[set.playerId]) groups[set.playerId] = []
      groups[set.playerId].push(set)
    }
    return groups
  }, [openedSets])

  // Calculate opened set total value for a player
  const getOpenedScore = (playerId: string) => {
    const sets = setsByPlayer[playerId]
    if (!sets) return 0
    return sets.reduce((total, set) => {
      return total + set.tiles.reduce((sum, t) => sum + (t.isJoker ? 0 : t.number), 0)
    }, 0)
  }

  const currentTurnPlayer = room.players.find(p => p.seat_position === gameState.current_turn)
  const currentTurnName = currentTurnPlayer?.user?.username || 'Oyuncu'

  const renderPlayerArea = (
    player: RoomPlayerWithUser | undefined,
    position: 'left' | 'top' | 'right',
    seatPos: number | undefined
  ) => {
    const isActive = player ? gameState.current_turn === player.seat_position : false
    const tileCount = getPlayerTileCount(player)
    const isAfk = player ? !player.is_connected : false
    const openedScore = player ? getOpenedScore(player.user_id) : 0
    const discardTile = seatPos !== undefined ? playerDiscards[seatPos.toString()] : null

    return (
      <div className="player-info">
        {/* Avatar */}
        {player?.user?.avatar_url ? (
          <img
            src={player.user.avatar_url}
            alt=""
            className={`player-avatar ${isActive ? 'active-turn' : ''}`}
          />
        ) : (
          <div className={`player-avatar flex items-center justify-center bg-[#1a3a5c] text-xs font-medium ${isActive ? 'active-turn' : ''}`}
            style={{ width: 32, height: 32, borderRadius: '50%' }}>
            {player?.user?.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        
        <div className="flex flex-col gap-0.5">
          <span className={`player-name ${isAfk ? 'opacity-50' : ''}`}>
            {isAfk && '💤 '}
            {player?.user?.username || 'Oyuncu'}
          </span>
          <div className="flex items-center gap-1">
            <span className="tile-count">{tileCount}</span>
            {openedScore > 0 && <span className="score-badge">{openedScore}p</span>}
          </div>
        </div>

        {/* Opponent's discard tile (small) */}
        {discardTile && position !== 'top' && (
          <div className="ml-1">
            <Tile tile={discardTile} size="small" okeyTile={okeyTile} />
          </div>
        )}
      </div>
    )
  }

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
              ? <span className="text-[#22c55e] font-bold">Kazandınız!</span>
              : <span className="text-[#8899aa]">Kazanan: <span className="text-white font-medium">{winnerName}</span></span>}
          </p>
          <p className="text-xs text-[#8899aa] mb-3">{fl[gameState.finish_type || 'normal']}</p>

          <div className="mb-4 text-left">
            <div className="grid grid-cols-4 text-[10px] text-[#8899aa] border-b border-[#1a3a5c] pb-1 mb-1">
              <span>Oyuncu</span><span className="text-center">El</span><span className="text-center">x</span><span className="text-right">Puan</span>
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
        <div className="bg-[#ef4444]/20 border-b border-[#ef4444] px-3 py-1 text-[#ef4444] text-[11px] text-center flex-shrink-0 z-10">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">×</button>
        </div>
      )}

      {/* Game table grid */}
      <div className="game-table-container flex-1 min-h-0">
        
        {/* TOP PLAYER */}
        <div className="player-top">
          {topPlayer ? (
            <>
              {renderPlayerArea(topPlayer, 'top', topSeat)}
              {/* Top player's discard tile */}
              {topSeat !== undefined && playerDiscards[topSeat.toString()] && (
                <div className="ml-2">
                  <Tile tile={playerDiscards[topSeat.toString()]!} size="small" okeyTile={okeyTile} />
                </div>
              )}
            </>
          ) : (
            <div className="waiting-seat">Kullanıcı Bekleniyor</div>
          )}

          {/* Indicator & turn info */}
          <div className="flex items-center gap-2 ml-auto">
            {indicatorTile && <Tile tile={indicatorTile} size="small" />}
            <div className={`px-2 py-0.5 rounded-full text-[11px] ${isMyTurn ? 'bg-[#22c55e]/20 text-[#22c55e] animate-pulse' : 'bg-[#1a3a5c] text-[#8899aa]'}`}>
              {isMyTurn ? (hasDrawn ? 'Taş At' : 'Taş Çek') : currentTurnName}
            </div>
            {onLeave && (
              <button onClick={onLeave} className="text-[#8899aa] hover:text-[#d4af37] text-sm">✕</button>
            )}
          </div>
        </div>

        {/* LEFT PLAYER */}
        <div className="player-left">
          {leftPlayer ? (
            <>
              <div className="side-tiles">
                {Array.from({ length: Math.min(getPlayerTileCount(leftPlayer), 8) }).map((_, i) => (
                  <TileBack key={i} size="small" />
                ))}
              </div>
              <div style={{ writingMode: 'horizontal-tb' }}>
                {renderPlayerArea(leftPlayer, 'left', leftSeat)}
              </div>
            </>
          ) : (
            <div className="waiting-seat" style={{ writingMode: 'horizontal-tb' }}>Bekleniyor</div>
          )}
        </div>

        {/* CENTER TABLE */}
        <div className="table-center">
          {/* Deck and draw areas */}
          <div className="deck-area">
            {/* Deck (draw from center) */}
            <div
              className={`deck-stack ${(!isMyTurn || hasDrawn || isLoading) ? 'disabled' : ''}`}
              onClick={() => handleDraw('deck')}
            >
              <div className="w-10 h-14 rounded bg-gradient-to-br from-[#d4af37] to-[#b8960f] shadow-lg" />
              <div className="w-10 h-14 rounded bg-gradient-to-br from-[#d4af37] to-[#b8960f] shadow-lg absolute top-0.5 left-0.5" />
              <span className="deck-count">{deck.length}</span>
            </div>
          </div>

          {/* Opened sets */}
          {openedSets.length > 0 && (
            <div className="opened-sets-area">
              {Object.entries(setsByPlayer).map(([playerId, sets]) => (
                <div key={playerId} className="opened-player-group">
                  <div className="opened-player-label">
                    <span>{getPlayerName(playerId)}</span>
                    <span className="score-badge">{getOpenedScore(playerId)}p</span>
                  </div>
                  <div className="opened-sets-row">
                    {sets.map(set => (
                      <div
                        key={set.id}
                        className="opened-set"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                        onDrop={(e) => handleSetDrop(e, set.id)}
                      >
                        {set.tiles.map((tile: TileType) => (
                          <Tile key={tile.id} tile={tile} size="small" okeyTile={okeyTile} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT PLAYER */}
        <div className="player-right">
          {rightPlayer ? (
            <>
              <div style={{ writingMode: 'horizontal-tb' }}>
                {renderPlayerArea(rightPlayer, 'right', rightSeat)}
              </div>
              <div className="side-tiles">
                {Array.from({ length: Math.min(getPlayerTileCount(rightPlayer), 8) }).map((_, i) => (
                  <TileBack key={i} size="small" />
                ))}
              </div>
            </>
          ) : (
            <div className="waiting-seat" style={{ writingMode: 'horizontal-tb' }}>Bekleniyor</div>
          )}
        </div>

        {/* BOTTOM (MY AREA) */}
        <div className="player-bottom">
          {/* Draw/Discard row */}
          <div className="flex items-center">
            {/* Left discard (from left player - I can draw) */}
            <div className="discard-left">
              <div
                className={`discard-slot ${leftDiscardTile ? 'has-tile' : ''} ${isMyTurn && !hasDrawn && leftDiscardTile ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (isMyTurn && !hasDrawn && leftDiscardTile) handleDraw('discard')
                }}
              >
                {leftDiscardTile ? (
                  <Tile tile={leftDiscardTile} okeyTile={okeyTile} />
                ) : (
                  <span className="text-[10px] text-[#8899aa]">Sol</span>
                )}
              </div>
            </div>

            {/* Hand */}
            <div className="flex-1 min-w-0">
              <PlayerHand
                tiles={myHand}
                selectedTiles={selectedTiles}
                onTileClick={toggleTileSelection}
                onTileDiscard={handleDiscard}
                okeyTile={okeyTile}
                isMyTurn={isMyTurn}
              />
            </div>

            {/* Right discard (my discard area - drop to discard) */}
            <div className="discard-right">
              <div
                className={`discard-slot ${myDiscardTile ? 'has-tile' : ''} ${isMyTurn && hasDrawn ? 'droppable' : ''}`}
                onDragOver={(e) => {
                  if (isMyTurn && hasDrawn) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    e.currentTarget.classList.add('over')
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('over')
                }}
                onDrop={(e) => {
                  e.currentTarget.classList.remove('over')
                  handleDiscardDrop(e)
                }}
              >
                {myDiscardTile ? (
                  <Tile tile={myDiscardTile} okeyTile={okeyTile} />
                ) : (
                  <span className="text-[10px] text-[#8899aa]">
                    {isMyTurn && hasDrawn ? 'Buraya at' : 'Sağ'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {isMyTurn && hasDrawn && selectedTiles.length > 0 && (
            <div className="flex justify-center gap-1.5 px-2 py-1 bg-[#0a1929]/80">
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
    </div>
  )
}
