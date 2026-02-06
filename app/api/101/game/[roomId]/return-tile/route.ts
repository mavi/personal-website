import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { drawFromDeck, addToHand, removeTilesFromHand } from '@/lib/101/game/deck'
import type { Tile } from '@/lib/101/game/tiles'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface GameStateRow {
    current_turn: number
    hands: Record<string, Tile[]>
    deck: Tile[]
    player_discards: Record<string, Tile | null>
    game_phase: string
    has_drawn: boolean
    pending_tile?: Tile | null
    must_open_or_return?: boolean
}

interface PlayerRow {
    seat_position: number
}

/**
 * Return a tile drawn from left discard and draw from deck instead.
 * This is used when a player who hasn't opened draws from left but cannot open 101+.
 */
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

        // Check if player has a pending tile to return
        if (!gameState.must_open_or_return || !gameState.pending_tile) {
            return NextResponse.json(
                { error: 'Geri verilecek taş yok' },
                { status: 400 }
            )
        }

        const pendingTile = gameState.pending_tile
        const hands = gameState.hands
        let deck = gameState.deck
        const playerDiscards = gameState.player_discards

        // Remove the pending tile from player's hand
        const currentHand = hands[decoded.userId]
        const tileIndex = currentHand.findIndex((t: Tile) => t.id === pendingTile.id)

        if (tileIndex === -1) {
            return NextResponse.json(
                { error: 'Taş elimizde bulunamadı' },
                { status: 400 }
            )
        }

        // Remove pending tile from hand
        const handWithoutPending = [...currentHand.slice(0, tileIndex), ...currentHand.slice(tileIndex + 1)]

        // Put the pending tile back into the left player's discard
        const leftSeat = ((player.seat_position + 3) % 4).toString()
        const newPlayerDiscards = { ...playerDiscards, [leftSeat]: pendingTile }

        // Draw a new tile from the deck
        const drawResult = drawFromDeck(deck)

        if (!drawResult.tile) {
            return NextResponse.json(
                { error: 'Deste boş, taş çekilemedi' },
                { status: 400 }
            )
        }

        const newTile = drawResult.tile
        const newDeck = drawResult.newDeck

        // Add new tile to hand
        const newHand = addToHand(handWithoutPending, newTile)
        const newHands = { ...hands, [decoded.userId]: newHand }

        // Update game state - clear the pending tile flags
        const { error: updateError } = await db
            .from('game_states')
            .update({
                hands: newHands,
                deck: newDeck,
                player_discards: newPlayerDiscards,
                has_drawn: true,
                pending_tile: null,
                must_open_or_return: false,
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
            tile: newTile,
            message: 'Taş geri verildi ve desteden yeni taş çekildi.'
        })
    } catch (error) {
        console.error('Return tile error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}
