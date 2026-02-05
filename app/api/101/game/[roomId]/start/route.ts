import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { dealTiles } from '@/lib/101/game/deck'
import type { SeatPosition } from '@/lib/101/game/constants'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface RoomRow {
  host_id: string
  status: string
  is_paired: boolean
  is_folding: boolean
}

interface PlayerRow {
  user_id: string
  seat_position: number
  is_ready: boolean
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
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get room and check if user is host
    const { data: roomData, error: roomError } = await db
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    const room = roomData as RoomRow | null

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Oda bulunamadı' },
        { status: 404 }
      )
    }

    if (room.host_id !== decoded.userId) {
      return NextResponse.json(
        { error: 'Sadece oda sahibi oyunu başlatabilir' },
        { status: 403 }
      )
    }

    if (room.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Oyun zaten başlamış' },
        { status: 400 }
      )
    }

    // Get players
    const { data: playersData, error: playersError } = await db
      .from('room_players')
      .select('user_id, seat_position, is_ready')
      .eq('room_id', roomId)
      .order('seat_position', { ascending: true })

    const players = (playersData || []) as PlayerRow[]

    if (playersError) {
      return NextResponse.json(
        { error: 'Oyuncular yüklenemedi' },
        { status: 500 }
      )
    }

    if (players.length !== 4) {
      return NextResponse.json(
        { error: '4 oyuncu gerekli' },
        { status: 400 }
      )
    }

    // Check if all players are ready
    const allReady = players.every(p => p.is_ready || p.user_id === decoded.userId)
    if (!allReady) {
      return NextResponse.json(
        { error: 'Tüm oyuncular hazır değil' },
        { status: 400 }
      )
    }

    // Create seat position mapping
    const seatPositions: Record<string, SeatPosition> = {}
    players.forEach(p => {
      seatPositions[p.user_id] = p.seat_position as SeatPosition
    })

    // Determine starting player (random)
    const startingPlayer = players[Math.floor(Math.random() * players.length)]

    // Deal tiles
    const { hands, deck, indicator, okeyDef } = dealTiles(
      players.map(p => p.user_id),
      seatPositions,
      startingPlayer.user_id
    )

    // Create game state
    const { error: gameStateError } = await db
      .from('game_states')
      .insert({
        room_id: roomId,
        current_turn: startingPlayer.seat_position,
        hands: hands,
        deck: deck,
        discard_pile: [],
        opened_sets: [],
        indicator_tile: indicator,
        okey_tile: okeyDef,
        game_phase: 'playing',
        has_drawn: false,
        turn_start_time: new Date().toISOString()
      })

    if (gameStateError) {
      console.error('Game state create error:', gameStateError)
      return NextResponse.json(
        { error: 'Oyun başlatılamadı' },
        { status: 500 }
      )
    }

    // Update room status
    await db
      .from('rooms')
      .update({ status: 'playing' })
      .eq('id', roomId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Game start error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
