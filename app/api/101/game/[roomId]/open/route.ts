import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { validatePer, validateOpening } from '@/lib/101/game/validation'
import type { Tile } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface GameStateRow {
  current_turn: number
  hands: Record<string, Tile[]>
  deck: Tile[]
  player_discards: Record<string, Tile | null>
  opened_sets: Array<{ id: string; playerId: string; tiles: Tile[]; type: string }>
  okey_tile: { color: TileColor; number: TileNumber }
  game_phase: string
  has_drawn: boolean
}

interface PlayerRow {
  seat_position: number
  user_id: string
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
    const { tileIds } = await request.json()

    if (!tileIds || !Array.isArray(tileIds) || tileIds.length < 3) {
      return NextResponse.json(
        { error: 'En az 3 taş seçmelisiniz' },
        { status: 400 }
      )
    }

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

    const okeyDef = gameState.okey_tile
    const hands = gameState.hands
    const playerHand = hands[decoded.userId] || []

    // Get the actual tile objects from the player's hand
    const tileIdSet = new Set(tileIds as string[])
    const tilesForSet: Tile[] = []

    for (const tileId of tileIds) {
      const tile = playerHand.find((t: Tile) => t.id === tileId)
      if (!tile) {
        return NextResponse.json(
          { error: 'Seçilen taşlardan bazıları elinizde yok' },
          { status: 400 }
        )
      }
      tilesForSet.push(tile)
    }

    // Validate the set
    const validation = validatePer(tilesForSet, okeyDef)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error || 'Geçersiz per' },
        { status: 400 }
      )
    }

    // Check if player has opened before (via opened_sets or opened_with_pairs)
    const existingOpenedSets = gameState.opened_sets || []
    const openedWithPairsMap = (gameState as GameStateRow & { opened_with_pairs?: Record<string, boolean> }).opened_with_pairs || {}
    const hasOpenedViaSets = existingOpenedSets.some(
      (s: { playerId: string }) => s.playerId === decoded.userId
    )
    const hasOpenedViaPairs = openedWithPairsMap[decoded.userId] === true
    const hasOpened = hasOpenedViaSets || hasOpenedViaPairs

    if (!hasOpened) {
      const openingValidation = validateOpening([tilesForSet], okeyDef)
      if (!openingValidation.isValid) {
        return NextResponse.json(
          { error: openingValidation.error || 'Açmak için en az 101 puan gerekli' },
          { status: 400 }
        )
      }
    }

    // Remove tiles from hand
    const newHand = playerHand.filter((t: Tile) => !tileIdSet.has(t.id))
    const newHands = { ...hands, [decoded.userId]: newHand }

    // Add to opened sets
    const newSet = {
      id: `${decoded.userId}-${Date.now()}`,
      playerId: decoded.userId,
      tiles: tilesForSet,
      type: validation.type
    }
    const newOpenedSets = [...existingOpenedSets, newSet]

    // Check if player finished (elden - 0 tiles left without discarding)
    if (newHand.length === 0) {
      const { data: roomData } = await db
        .from('rooms')
        .select('is_paired')
        .eq('id', roomId)
        .single()

      await db
        .from('game_states')
        .update({
          hands: newHands,
          opened_sets: newOpenedSets,
          game_phase: 'finished',
          winner: decoded.userId,
          finish_type: 'elden',
          updated_at: new Date().toISOString()
        })
        .eq('room_id', roomId)

      await db
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)

      // Get all players for match record
      const { data: allPlayersData } = await db
        .from('room_players')
        .select('user_id, seat_position')
        .eq('room_id', roomId)

      const allPlayers = (allPlayersData || []) as PlayerRow[]

      // Record match
      const finalScores: Record<string, number> = {}
      for (const p of allPlayers) {
        if (p.user_id === decoded.userId) {
          finalScores[p.user_id] = 0
        } else {
          const hand = newHands[p.user_id] || []
          let score = 0
          for (const t of hand) {
            if (t.isJoker) {
              score += okeyDef.number
            } else if (t.color === okeyDef.color && t.number === okeyDef.number) {
              score += 25
            } else {
              score += t.number
            }
          }
          finalScores[p.user_id] = score * 2 // elden = x2
        }
      }

      await db
        .from('matches')
        .insert({
          room_id: roomId,
          players: allPlayers.map(p => p.user_id),
          final_scores: finalScores,
          winner_id: decoded.userId,
          game_mode: roomData?.is_paired ? 'paired' : 'solo',
          finish_type: 'elden'
        })

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
        finishType: 'elden'
      })
    }

    // Just update the game state with opened sets
    // Clear must_open_or_return flag if player successfully opened
    await db
      .from('game_states')
      .update({
        hands: newHands,
        opened_sets: newOpenedSets,
        pending_tile: null,
        must_open_or_return: false,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Open sets error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
