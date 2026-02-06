import { NextResponse } from 'next/server'
import { createClient } from '@/lib/101/supabase/server'
import { drawFromDeck } from '@/lib/101/game/deck'
import type { Tile } from '@/lib/101/game/tiles'
import { ISLER_TAS_PENALTY, NOT_OPENED_PENALTY, MULTIPLIER_ELDEN_FINISH, MULTIPLIER_PAIRS_OPENING } from '@/lib/101/game/constants'
import type { SeatPosition } from '@/lib/101/game/constants'

const AFK_TIMEOUT_MS = 15_000 // 15 seconds

interface GameStateRow {
  id: string
  room_id: string
  current_turn: number
  hands: Record<string, Tile[]>
  deck: Tile[]
  player_discards: Record<string, Tile | null>
  opened_sets: Array<{ id: string; playerId: string; tiles: Tile[]; type: string }>
  indicator_tile: Tile | null
  okey_tile: { color: string; number: number } | null
  game_phase: string
  has_drawn: boolean
  turn_start_time: string | null
  winner: string | null
  finish_type: string | null
  opened_with_pairs?: Record<string, boolean>
  isler_tas_penalties?: Record<string, number>
}

interface PlayerRow {
  user_id: string
  seat_position: number
  is_connected: boolean
  last_seen: string
  has_opened?: boolean
}

interface RoomRow {
  id: string
  is_paired: boolean
  status: string
}

// Helper: finish game with auto-win
async function finishGameAutoWin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  roomId: string,
  winnerId: string | null,
  gameState: GameStateRow,
  players: PlayerRow[],
  room: RoomRow
) {
  await db
    .from('game_states')
    .update({
      game_phase: 'finished',
      winner: winnerId,
      finish_type: winnerId ? 'normal' : null,
      updated_at: new Date().toISOString()
    })
    .eq('room_id', roomId)

  await db
    .from('rooms')
    .update({ status: 'finished' })
    .eq('id', roomId)

  // Record match with proper penalties
  const finalScores: Record<string, number> = {}
  const openedWithPairs = gameState.opened_with_pairs || {}
  const islerTasPenalties = gameState.isler_tas_penalties || {}
  const okeyDef = gameState.okey_tile

  // Check which players have opened
  const openedSets = gameState.opened_sets || []
  const playersWhoOpened = new Set(openedSets.map((s: { playerId: string }) => s.playerId))

  for (const p of players) {
    if (p.user_id === winnerId) {
      finalScores[p.user_id] = 0
    } else {
      // Check for acmama penalty (didn't open at all)
      if (!playersWhoOpened.has(p.user_id)) {
        finalScores[p.user_id] = NOT_OPENED_PENALTY
        continue
      }

      // Calculate hand value
      const hand = gameState.hands[p.user_id] || []
      let handValue = 0
      for (const t of hand) {
        if (t.isJoker) {
          handValue += okeyDef?.number || 1
        } else if (okeyDef && t.color === okeyDef.color && t.number === okeyDef.number) {
          handValue += 25 // Okey in hand penalty
        } else {
          handValue += t.number || 1
        }
      }

      // Apply multiplier for ciftten acma
      let multiplier = 1
      if (openedWithPairs[p.user_id]) {
        multiplier = MULTIPLIER_PAIRS_OPENING
      }

      // Add isler tas penalties
      const islerPenalty = islerTasPenalties[p.user_id] || 0

      finalScores[p.user_id] = (handValue * multiplier) + islerPenalty
    }
  }

  await db
    .from('matches')
    .insert({
      room_id: roomId,
      players: players.map(p => p.user_id),
      final_scores: finalScores,
      winner_id: winnerId,
      game_mode: room.is_paired ? 'paired' : 'solo',
      finish_type: winnerId ? 'normal' : null
    })

  // Update player stats
  if (winnerId) {
    for (const p of players) {
      if (p.user_id === winnerId) {
        await db.rpc('increment_wins', { user_id: p.user_id })
      } else {
        await db.rpc('increment_losses', { user_id: p.user_id })
      }
    }
  }
}

// Helper: check auto-win conditions and apply if met
async function checkAutoWin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  roomId: string,
  gameState: GameStateRow,
  players: PlayerRow[],
  room: RoomRow
): Promise<boolean> {
  const connectedPlayers = players.filter(p => p.is_connected)

  if (connectedPlayers.length === 0) {
    await finishGameAutoWin(db, roomId, null, gameState, players, room)
    return true
  }

  if (room.is_paired) {
    const teamA = players.filter(p => p.seat_position === 0 || p.seat_position === 2)
    const teamB = players.filter(p => p.seat_position === 1 || p.seat_position === 3)

    const teamAConnected = teamA.some(p => p.is_connected)
    const teamBConnected = teamB.some(p => p.is_connected)

    if (!teamAConnected && teamBConnected) {
      const winner = connectedPlayers.find(p => p.seat_position === 1 || p.seat_position === 3)
      await finishGameAutoWin(db, roomId, winner?.user_id || null, gameState, players, room)
      return true
    }
    if (!teamBConnected && teamAConnected) {
      const winner = connectedPlayers.find(p => p.seat_position === 0 || p.seat_position === 2)
      await finishGameAutoWin(db, roomId, winner?.user_id || null, gameState, players, room)
      return true
    }
  } else {
    if (connectedPlayers.length === 1) {
      await finishGameAutoWin(db, roomId, connectedPlayers[0].user_id, gameState, players, room)
      return true
    }
  }

  return false
}

// GET - Get current game state (with AFK auto-play)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: gameState } = await db
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .single()

    if (!gameState || gameState.game_phase !== 'playing') {
      return NextResponse.json({ gameState: gameState || null })
    }

    // Get players and room info
    const { data: playersData } = await db
      .from('room_players')
      .select('user_id, seat_position, is_connected, last_seen')
      .eq('room_id', roomId)

    const players = (playersData || []) as PlayerRow[]

    const { data: roomData } = await db
      .from('rooms')
      .select('id, is_paired, status')
      .eq('id', roomId)
      .single()

    const room = roomData as RoomRow | null

    if (!room || players.length === 0) {
      return NextResponse.json({ gameState })
    }

    // Mark players as disconnected if last_seen is too old
    const now = Date.now()
    for (const p of players) {
      if (p.is_connected && p.last_seen) {
        const lastSeen = new Date(p.last_seen).getTime()
        if (now - lastSeen > AFK_TIMEOUT_MS) {
          p.is_connected = false
          await db
            .from('room_players')
            .update({ is_connected: false })
            .eq('room_id', roomId)
            .eq('user_id', p.user_id)
        }
      }
    }

    // Check auto-win conditions
    const autoWinTriggered = await checkAutoWin(db, roomId, gameState as GameStateRow, players, room)
    if (autoWinTriggered) {
      const { data: updatedState } = await db
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single()
      return NextResponse.json({ gameState: updatedState || null })
    }

    // Turn timeout: check if turn_start_time is older than 60 seconds
    const TURN_TIMEOUT_MS = 60_000 // 60 seconds
    const gs = gameState as GameStateRow
    const currentTurnPlayer = players.find(p => p.seat_position === gs.current_turn)

    // Check for turn timeout (even if player is connected)
    const turnTimedOut = gs.turn_start_time &&
      (now - new Date(gs.turn_start_time).getTime() > TURN_TIMEOUT_MS)

    // AFK auto-play: check if current turn player is disconnected OR turn timed out

    if (currentTurnPlayer && (!currentTurnPlayer.is_connected || turnTimedOut)) {
      let updatedGs = { ...gs }

      if (!updatedGs.has_drawn) {
        // Auto-draw from deck
        const { tile, newDeck } = drawFromDeck(updatedGs.deck)
        if (tile) {
          const hand = updatedGs.hands[currentTurnPlayer.user_id] || []
          updatedGs = {
            ...updatedGs,
            deck: newDeck,
            hands: { ...updatedGs.hands, [currentTurnPlayer.user_id]: [...hand, tile] },
            has_drawn: true
          }
        }
      }

      if (updatedGs.has_drawn) {
        // Auto-discard a random tile
        const hand = updatedGs.hands[currentTurnPlayer.user_id] || []
        if (hand.length > 0) {
          const randomIdx = Math.floor(Math.random() * hand.length)
          const discardedTile = hand[randomIdx]
          const newHand = [...hand.slice(0, randomIdx), ...hand.slice(randomIdx + 1)]

          const seatKey = currentTurnPlayer.seat_position.toString()
          const newPlayerDiscards = { ...updatedGs.player_discards, [seatKey]: discardedTile }

          const nextTurn = ((updatedGs.current_turn + 1) % 4) as SeatPosition

          await db
            .from('game_states')
            .update({
              hands: { ...updatedGs.hands, [currentTurnPlayer.user_id]: newHand },
              deck: updatedGs.deck,
              player_discards: newPlayerDiscards,
              current_turn: nextTurn,
              has_drawn: false,
              turn_start_time: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId)
        } else {
          const nextTurn = ((updatedGs.current_turn + 1) % 4) as SeatPosition
          await db
            .from('game_states')
            .update({
              current_turn: nextTurn,
              has_drawn: false,
              turn_start_time: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId)
        }
      }

      // Re-fetch the updated game state
      const { data: updatedState } = await db
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single()
      return NextResponse.json({ gameState: updatedState || null })
    }

    return NextResponse.json({ gameState: gameState || null })
  } catch (error) {
    console.error('Game state error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
