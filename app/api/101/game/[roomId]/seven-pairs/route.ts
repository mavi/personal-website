import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { validateSevenPairs } from '@/lib/101/game/tiles'
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
        const { pairs } = await request.json()

        // Validate 7 pairs
        const validation = validateSevenPairs(pairs)
        if (!validation.isValid) {
            return NextResponse.json(
                { error: validation.error || 'Geçersiz 7 çift' },
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

        // Check if player has already opened
        const openedSets = gameState.opened_sets || []
        const hasOpened = openedSets.some((s: { playerId: string }) => s.playerId === decoded.userId)

        if (hasOpened) {
            return NextResponse.json(
                { error: 'Zaten açtınız' },
                { status: 400 }
            )
        }

        // Verify player has exactly 14 tiles
        const playerHand = gameState.hands[decoded.userId] || []
        if (playerHand.length !== 14) {
            return NextResponse.json(
                { error: '7 çift açmak için elinizde tam 14 taş olmalı' },
                { status: 400 }
            )
        }

        // Verify player has all these tiles
        const tileIds = pairs.flat().map((t: Tile) => t.id)
        const playerTileIds = new Set(playerHand.map((t: Tile) => t.id))

        for (const tileId of tileIds) {
            if (!playerTileIds.has(tileId)) {
                return NextResponse.json(
                    { error: 'Bu taşlardan bazıları elinizde yok' },
                    { status: 400 }
                )
            }
        }

        // Get room info for scoring
        const { data: roomData } = await db
            .from('rooms')
            .select('is_paired')
            .eq('id', roomId)
            .single()

        // 7 pairs = instant win with x2 multiplier
        await db
            .from('game_states')
            .update({
                hands: { ...gameState.hands, [decoded.userId]: [] },
                game_phase: 'finished',
                winner: decoded.userId,
                finish_type: 'yedi_cift',
                updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId)

        await db
            .from('rooms')
            .update({ status: 'finished' })
            .eq('id', roomId)

        // Get all players for scoring
        const { data: allPlayersData } = await db
            .from('room_players')
            .select('user_id, seat_position')
            .eq('room_id', roomId)

        const allPlayers = (allPlayersData || []) as PlayerRow[]
        const okeyDef = gameState.okey_tile

        // Calculate scores with x2 for yedi_cift
        const finalScores: Record<string, number> = {}
        for (const p of allPlayers) {
            if (p.user_id === decoded.userId) {
                finalScores[p.user_id] = 0
            } else {
                const hand = gameState.hands[p.user_id] || []
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
                finalScores[p.user_id] = score * 2 // x2 for yedi_cift
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
                finish_type: 'yedi_cift'
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
            finishType: 'yedi_cift',
            scores: finalScores
        })
    } catch (error) {
        console.error('Seven pairs opening error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}
