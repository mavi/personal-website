import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import type { Tile } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface GameStateRow {
    current_turn: number
    hands: Record<string, Tile[]>
    opened_sets: Array<{ id: string; playerId: string; tiles: Tile[]; type: string }>
    okey_tile: { color: TileColor; number: TileNumber }
    game_phase: string
    has_drawn: boolean
    opened_with_pairs?: Record<string, boolean>
}

interface PlayerRow {
    seat_position: number
    user_id: string
}

// Validate that pair tiles are identical (same color and number)
function isValidPair(tiles: Tile[]): boolean {
    if (tiles.length !== 2) return false
    if (tiles[0].isJoker || tiles[1].isJoker) return false
    return tiles[0].color === tiles[1].color && tiles[0].number === tiles[1].number
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
        const { pairs } = await request.json()

        // Validate pairs format
        if (!pairs || !Array.isArray(pairs) || pairs.length !== 5) {
            return NextResponse.json(
                { error: '5 çift gerekli' },
                { status: 400 }
            )
        }

        // Validate each pair
        for (const pair of pairs) {
            if (!isValidPair(pair)) {
                return NextResponse.json(
                    { error: 'Çiftler aynı taş olmalı (renk + numara), joker kullanılamaz' },
                    { status: 400 }
                )
            }
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

        // Check if player has already opened
        const openedSets = gameState.opened_sets || []
        const hasOpened = openedSets.some((s: { playerId: string }) => s.playerId === decoded.userId)

        if (hasOpened) {
            return NextResponse.json(
                { error: 'Zaten açtınız' },
                { status: 400 }
            )
        }

        // Verify player has all these tiles
        const tileIds = pairs.flat().map((t: Tile) => t.id)
        const playerHand = gameState.hands[decoded.userId] || []
        const playerTileIds = new Set(playerHand.map((t: Tile) => t.id))

        for (const tileId of tileIds) {
            if (!playerTileIds.has(tileId)) {
                return NextResponse.json(
                    { error: 'Bu taşlardan bazıları elinizde yok' },
                    { status: 400 }
                )
            }
        }

        // Mark player as opened with pairs (x2 penalty if loses)
        const openedWithPairs = gameState.opened_with_pairs || {}
        openedWithPairs[decoded.userId] = true

        // Update the game state - player is now "opened" but tiles stay in hand
        await db
            .from('game_states')
            .update({
                opened_with_pairs: openedWithPairs,
                updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId)

        return NextResponse.json({
            success: true,
            message: '5 çift ile açtınız. Kaybederseniz x2 ceza alacaksınız.'
        })
    } catch (error) {
        console.error('Five pairs opening error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}
