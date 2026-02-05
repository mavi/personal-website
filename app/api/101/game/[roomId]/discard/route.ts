import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { discardTile } from '@/lib/101/game/deck'
import { isOkeyTile } from '@/lib/101/game/tiles'
import { calculateFinalScores } from '@/lib/101/game/scoring'
import type { Tile } from '@/lib/101/game/tiles'
import type { SeatPosition, TileColor, TileNumber } from '@/lib/101/game/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface GameStateRow {
  current_turn: number
  hands: Record<string, Tile[]>
  discard_pile: Tile[]
  okey_tile: { color: TileColor; number: TileNumber }
  game_phase: string
  has_drawn: boolean
}

interface PlayerRow {
  seat_position: number
  user_id: string
}

interface RoomRow {
  is_paired: boolean
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Giriş yapmalısınız' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decoded: { userId: string }
    
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    } catch {
      return NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      )
    }

    const { roomId } = await params
    const { tileId } = await request.json()
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get player's seat position
    const { data: playerData } = await db
      .from('room_players')
      .select('seat_position')
      .eq('room_id', roomId)
      .eq('user_id', decoded.userId)
      .single()

    const player = playerData as PlayerRow | null

    if (!player) {
      return NextResponse.json(
        { error: 'Bu odada değilsiniz' },
        { status: 403 }
      )
    }

    // Get game state
    const { data: gameStateData, error: gameError } = await db
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .single()

    const gameState = gameStateData as GameStateRow | null

    if (gameError || !gameState) {
      return NextResponse.json(
        { error: 'Oyun bulunamadı' },
        { status: 404 }
      )
    }

    if (gameState.game_phase !== 'playing') {
      return NextResponse.json(
        { error: 'Oyun aktif değil' },
        { status: 400 }
      )
    }

    if (gameState.current_turn !== player.seat_position) {
      return NextResponse.json(
        { error: 'Sıra sizde değil' },
        { status: 400 }
      )
    }

    if (!gameState.has_drawn) {
      return NextResponse.json(
        { error: 'Önce taş çekmelisiniz' },
        { status: 400 }
      )
    }

    const hands = gameState.hands
    const discardPile = gameState.discard_pile
    const okeyDef = gameState.okey_tile

    // Discard tile
    const { newHand, newPile, discardedTile } = discardTile(
      hands[decoded.userId],
      tileId,
      discardPile
    )

    if (!discardedTile) {
      return NextResponse.json(
        { error: 'Taş bulunamadı' },
        { status: 400 }
      )
    }

    const newHands = { ...hands, [decoded.userId]: newHand }

    // Check if player finished (0 tiles left)
    if (newHand.length === 0) {
      // Player won!
      const finishType = isOkeyTile(discardedTile, okeyDef) ? 'okey' : 'normal'
      
      // Get room for game mode
      const { data: roomData } = await db
        .from('rooms')
        .select('is_paired')
        .eq('id', roomId)
        .single()

      const room = roomData as RoomRow | null

      // Get all players with seat positions
      const { data: allPlayersData } = await db
        .from('room_players')
        .select('user_id, seat_position')
        .eq('room_id', roomId)

      const allPlayers = (allPlayersData || []) as PlayerRow[]

      // Calculate scores
      const playersWithHands = allPlayers.map(p => ({
        id: p.user_id,
        seatPosition: p.seat_position as SeatPosition,
        hand: newHands[p.user_id] || []
      }))

      const scores = calculateFinalScores(
        playersWithHands,
        decoded.userId,
        player.seat_position as SeatPosition,
        finishType,
        room?.is_paired ? 'paired' : 'solo',
        okeyDef
      )

      // Update game state to finished
      await db
        .from('game_states')
        .update({
          hands: newHands,
          discard_pile: newPile,
          game_phase: 'finished',
          winner: decoded.userId,
          finish_type: finishType,
          updated_at: new Date().toISOString()
        })
        .eq('room_id', roomId)

      // Update room status
      await db
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)

      // Record match
      await db
        .from('matches')
        .insert({
          room_id: roomId,
          players: allPlayers.map(p => p.user_id),
          final_scores: Object.fromEntries(scores.map(s => [s.playerId, s.finalScore])),
          winner_id: decoded.userId,
          game_mode: room?.is_paired ? 'paired' : 'solo',
          finish_type: finishType
        })

      // Update player stats
      for (const p of allPlayers) {
        if (p.user_id === decoded.userId) {
          await db.rpc('increment_wins', { user_id: p.user_id })
        } else {
          await db.rpc('increment_losses', { user_id: p.user_id })
        }
      }

      return NextResponse.json({ 
        success: true, 
        gameOver: true, 
        winner: decoded.userId,
        scores 
      })
    }

    // Move to next turn
    const nextTurn = ((gameState.current_turn + 1) % 4) as SeatPosition

    await db
      .from('game_states')
      .update({
        hands: newHands,
        discard_pile: newPile,
        current_turn: nextTurn,
        has_drawn: false,
        turn_start_time: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Discard error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
