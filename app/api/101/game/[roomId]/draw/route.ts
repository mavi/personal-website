import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { drawFromDeck, addToHand } from '@/lib/101/game/deck'
import type { Tile } from '@/lib/101/game/tiles'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface GameStateRow {
  current_turn: number
  hands: Record<string, Tile[]>
  deck: Tile[]
  player_discards: Record<string, Tile | null>
  game_phase: string
  has_drawn: boolean
  opened_sets?: Array<{ playerId: string }>
  opened_with_pairs?: Record<string, boolean>
  pending_tile?: Tile | null // Tile drawn from left that must be opened with or returned
  must_open_or_return?: boolean // Flag when player drew from left but hasn't opened
}

interface PlayerRow {
  seat_position: number
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
    const { source } = await request.json() // 'deck' or 'discard'
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

    if (gameState.has_drawn) {
      return NextResponse.json(
        { error: 'Bu turda zaten taş çektiniz' },
        { status: 400 }
      )
    }

    const hands = gameState.hands
    const deck = gameState.deck
    const playerDiscards = gameState.player_discards

    let tile: Tile | null = null
    let newDeck = deck
    let newPlayerDiscards = { ...playerDiscards }

    if (source === 'deck') {
      let currentDeck = deck

      // If deck is empty, reshuffle discards back into deck
      if (currentDeck.length === 0) {
        const tilesToReshuffle: Tile[] = []
        const clearedDiscards = { ...playerDiscards }

        // Collect all discard tiles except the current player's left discard (they might want to draw it)
        for (let seat = 0; seat < 4; seat++) {
          const seatKey = seat.toString()
          const discardedTile = playerDiscards[seatKey]
          if (discardedTile) {
            tilesToReshuffle.push(discardedTile)
            clearedDiscards[seatKey] = null
          }
        }

        if (tilesToReshuffle.length === 0) {
          return NextResponse.json(
            { error: 'Deste boş ve atılan taş yok' },
            { status: 400 }
          )
        }

        // Shuffle the collected tiles (Fisher-Yates)
        for (let i = tilesToReshuffle.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
            ;[tilesToReshuffle[i], tilesToReshuffle[j]] = [tilesToReshuffle[j], tilesToReshuffle[i]]
        }

        currentDeck = tilesToReshuffle
        newPlayerDiscards = clearedDiscards
      }

      const result = drawFromDeck(currentDeck)
      if (!result.tile) {
        return NextResponse.json(
          { error: 'Deste boş' },
          { status: 400 }
        )
      }
      tile = result.tile
      newDeck = result.newDeck
    } else if (source === 'discard') {
      // Draw from the left player's discard
      const leftSeat = ((player.seat_position + 3) % 4).toString()
      const discardTile = playerDiscards[leftSeat]

      if (!discardTile) {
        return NextResponse.json(
          { error: 'Soldaki oyuncunun attığı taş yok' },
          { status: 400 }
        )
      }

      // Check if player has opened (via opened_sets or opened_with_pairs)
      const openedSets = gameState.opened_sets || []
      const openedWithPairs = gameState.opened_with_pairs || {}
      const hasOpened = openedSets.some(s => s.playerId === decoded.userId) ||
        openedWithPairs[decoded.userId] === true

      tile = discardTile
      newPlayerDiscards = { ...playerDiscards, [leftSeat]: null }

      // If player hasn't opened, they MUST open after drawing from left or return the tile
      if (!hasOpened) {
        // Add tile to hand first, then set the restriction flag
        const newHand = addToHand(hands[decoded.userId], tile)
        const newHands = { ...hands, [decoded.userId]: newHand }

        const { error: updateError } = await db
          .from('game_states')
          .update({
            hands: newHands,
            deck: newDeck,
            player_discards: newPlayerDiscards,
            has_drawn: true,
            pending_tile: tile,
            must_open_or_return: true,
            updated_at: new Date().toISOString()
          })
          .eq('room_id', roomId)

        if (updateError) {
          console.error('Update error:', updateError)
          return NextResponse.json(
            { error: 'Oyun güncellenemedi' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          tile,
          mustOpen: true,
          message: 'Soldan taş çektiniz. El açmanız veya taşı geri vermeniz gerekiyor.'
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Geçersiz kaynak' },
        { status: 400 }
      )
    }

    // Add tile to player's hand
    const newHand = addToHand(hands[decoded.userId], tile)
    const newHands = { ...hands, [decoded.userId]: newHand }

    // Update game state
    const { error: updateError } = await db
      .from('game_states')
      .update({
        hands: newHands,
        deck: newDeck,
        player_discards: newPlayerDiscards,
        has_drawn: true,
        updated_at: new Date().toISOString()
      })
      .eq('room_id', roomId)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json(
        { error: 'Oyun güncellenemedi' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, tile })
  } catch (error) {
    console.error('Draw error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
