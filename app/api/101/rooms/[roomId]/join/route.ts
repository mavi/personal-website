import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface RoomRow {
  id: string
  status: string
  player_count: number
}

interface PlayerRow {
  room_id: string
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
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check if room exists and is waiting
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

    if (room.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Bu oda oyunda veya kapanmış' },
        { status: 400 }
      )
    }

    if (room.player_count >= 4) {
      return NextResponse.json(
        { error: 'Oda dolu' },
        { status: 400 }
      )
    }

    // Check if user is already in any room
    const { data: existingPlayerData } = await db
      .from('room_players')
      .select('room_id')
      .eq('user_id', decoded.userId)
      .single()

    const existingPlayer = existingPlayerData as PlayerRow | null

    if (existingPlayer) {
      if (existingPlayer.room_id === roomId) {
        return NextResponse.json({ success: true, message: 'Zaten bu odasınız' })
      }
      return NextResponse.json(
        { error: 'Zaten başka bir odadasınız' },
        { status: 400 }
      )
    }

    // Get current players to find an empty seat
    const { data: playersData } = await db
      .from('room_players')
      .select('seat_position')
      .eq('room_id', roomId)

    const players = (playersData || []) as PlayerRow[]
    const occupiedSeats = new Set(players.map(p => p.seat_position))
    let seatPosition = 0
    for (let i = 0; i < 4; i++) {
      if (!occupiedSeats.has(i)) {
        seatPosition = i
        break
      }
    }

    // Add player to room
    const { error: joinError } = await db
      .from('room_players')
      .insert({
        room_id: roomId,
        user_id: decoded.userId,
        seat_position: seatPosition,
        is_ready: false
      })

    if (joinError) {
      console.error('Join error:', joinError)
      return NextResponse.json(
        { error: 'Odaya katılınamadı' },
        { status: 500 }
      )
    }

    // Update player count
    await db
      .from('rooms')
      .update({ player_count: room.player_count + 1 })
      .eq('id', roomId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Join room error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
