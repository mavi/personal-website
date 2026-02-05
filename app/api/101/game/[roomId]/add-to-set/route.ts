import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { canAddToPer } from '@/lib/101/game/validation'
import type { Tile } from '@/lib/101/game/tiles'
import { ISLER_TAS_PENALTY, NOT_OPENED_PENALTY, MULTIPLIER_ELDEN_FINISH } from '@/lib/101/game/constants'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface GameStateRow {
  current_turn: number
  hands: Record<string, Tile[]>
  opened_sets: Array<{ id: string; playerId: string; tiles: Tile[]; type: string }>
  okey_tile: { color: TileColor; number: TileNumber }
  game_phase: string
  has_drawn: boolean
  isler_tas_penalties?: Record<string, number>
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
    const { tileId, setId } = await request.json()

    if (!tileId || !setId) {
      return NextResponse.json(
        { error: 'tileId ve setId gerekli' },
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
    const openedSets = gameState.opened_sets || []

    // Check if player has opened (must have opened to add to sets)
    // Player can be opened via opened_sets OR via opened_with_pairs (5-pair opening)
    const openedWithPairsMap = (gameState as GameStateRow & { opened_with_pairs?: Record<string, boolean> }).opened_with_pairs || {}
    const hasOpenedViaSets = openedSets.some(
      (s: { playerId: string }) => s.playerId === decoded.userId
    )
    const hasOpenedViaPairs = openedWithPairsMap[decoded.userId] === true
    const hasOpened = hasOpenedViaSets || hasOpenedViaPairs

    if (!hasOpened) {
      return NextResponse.json(
        { error: 'Önce el açmalısınız' },
        { status: 400 }
      )
    }

    // Find the tile in player's hand
    const tile = playerHand.find((t: Tile) => t.id === tileId)
    if (!tile) {
      return NextResponse.json(
        { error: 'Taş elinizde bulunamadı' },
        { status: 400 }
      )
    }

    // Find the target set
    const setIndex = openedSets.findIndex((s: { id: string }) => s.id === setId)
    if (setIndex === -1) {
      return NextResponse.json(
        { error: 'Per bulunamadı' },
        { status: 400 }
      )
    }

    const targetSet = openedSets[setIndex]
    const isOpponentSet = targetSet.playerId !== decoded.userId

    // Check if tile can be added
    const addResult = canAddToPer(targetSet.tiles, tile, okeyDef)
    if (!addResult.canAdd) {
      return NextResponse.json(
        { error: addResult.error || 'Bu taş bu pere eklenemez' },
        { status: 400 }
      )
    }

    // Add tile to the set at the correct position
    const newSetTiles = addResult.position === 'start'
      ? [tile, ...targetSet.tiles]
      : [...targetSet.tiles, tile]

    const newOpenedSets = [...openedSets]
    newOpenedSets[setIndex] = { ...targetSet, tiles: newSetTiles }

    // Remove tile from hand
    const newHand = playerHand.filter((t: Tile) => t.id !== tileId)
    const newHands = { ...hands, [decoded.userId]: newHand }

    // Track isler tas penalty if adding to opponent's set
    let islerTasPenalties = gameState.isler_tas_penalties || {}
    if (isOpponentSet) {
      const currentPenalty = islerTasPenalties[decoded.userId] || 0
      islerTasPenalties = {
        ...islerTasPenalties,
        [decoded.userId]: currentPenalty + ISLER_TAS_PENALTY
      }
    }

    // Check if player finished (elden)
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

      const { data: allPlayersData } = await db
        .from('room_players')
        .select('user_id, seat_position')
        .eq('room_id', roomId)

      const allPlayers = (allPlayersData || []) as PlayerRow[]

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
          finalScores[p.user_id] = score * 2
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

    // Update the game state
    await db
      .from('game_states')
      .update({
        hands: newHands,
        opened_sets: newOpenedSets,
        isler_tas_penalties: islerTasPenalties,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Add to set error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}

