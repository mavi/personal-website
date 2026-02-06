import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface RoomRow {
  id: string
  status: string
  player_count: number
  password: string | null
}

interface PlayerRow {
  room_id: string
  seat_position: number
  user_id: string
  is_connected: boolean
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
    let bodyPassword: string | undefined
    try {
      const body = await request.json()
      bodyPassword = body?.password
    } catch {
      // No body or not JSON - that's fine for rooms without password
    }

    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check if room exists
    const { data: roomData, error: roomError } = await db
      .from('rooms')
      .select('id, status, player_count, password')
      .eq('id', roomId)
      .maybeSingle()

    if (roomError) {
      console.error('Room fetch error:', roomError)
      return NextResponse.json(
        { error: `Oda sorgulanırken hata: ${roomError.message}` },
        { status: 500 }
      )
    }

    const room = roomData as RoomRow | null

    if (!room) {
      return NextResponse.json(
        { error: 'Oda bulunamadı' },
        { status: 404 }
      )
    }

    // Check if user already exists in this room (for rejoin support)
    const { data: existingInRoomData, error: existingError } = await db
      .from('room_players')
      .select('room_id, seat_position, user_id, is_connected')
      .eq('room_id', roomId)
      .eq('user_id', decoded.userId)
      .maybeSingle()

    if (existingError) {
      console.error('Existing player check error:', existingError)
      return NextResponse.json(
        { error: `Oyuncu kontrolünde hata: ${existingError.message}` },
        { status: 500 }
      )
    }

    const existingInRoom = existingInRoomData as PlayerRow | null

    if (existingInRoom) {
      if (existingInRoom.is_connected) {
        // Already connected in this room
        return NextResponse.json({ success: true, message: 'Zaten bu odasınız' })
      }

      // Rejoin: player was disconnected, reconnect them
      if (room.status === 'playing' || room.status === 'waiting') {
        const { error: reconnectError } = await db
          .from('room_players')
          .update({
            is_connected: true,
            last_seen: new Date().toISOString()
          })
          .eq('room_id', roomId)
          .eq('user_id', decoded.userId)

        if (reconnectError) {
          console.error('Reconnect error:', reconnectError)
          return NextResponse.json(
            { error: `Yeniden bağlanma hatası: ${reconnectError.message}` },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true, message: 'Odaya geri döndünüz', rejoin: true })
      }
    }

    // Check password if room has one
    if (room.password && room.password !== bodyPassword) {
      return NextResponse.json(
        { error: 'Şifre yanlış', requiresPassword: true },
        { status: 403 }
      )
    }

    // Normal join flow - room must be waiting
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

    // Check if user is already in a different room
    const { data: existingPlayerData, error: otherRoomError } = await db
      .from('room_players')
      .select('room_id')
      .eq('user_id', decoded.userId)
      .neq('room_id', roomId)
      .maybeSingle()

    if (otherRoomError) {
      console.error('Other room check error:', otherRoomError)
      return NextResponse.json(
        { error: `Diğer oda kontrolünde hata: ${otherRoomError.message}` },
        { status: 500 }
      )
    }

    if (existingPlayerData) {
      return NextResponse.json(
        { error: 'Zaten başka bir odadasınız' },
        { status: 400 }
      )
    }

    // Get current players to find an empty seat
    const { data: playersData, error: playersError } = await db
      .from('room_players')
      .select('seat_position')
      .eq('room_id', roomId)

    if (playersError) {
      console.error('Players fetch error:', playersError)
      return NextResponse.json(
        { error: `Oyuncular alınırken hata: ${playersError.message}` },
        { status: 500 }
      )
    }

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
    const insertData = {
      room_id: roomId,
      user_id: decoded.userId,
      seat_position: seatPosition,
      is_ready: false,
      is_connected: true,
      last_seen: new Date().toISOString()
    }

    console.log('Attempting to insert player:', insertData)

    const { data: insertedData, error: joinError } = await db
      .from('room_players')
      .insert(insertData)
      .select()

    if (joinError) {
      console.error('Join error details:', {
        error: joinError,
        code: joinError.code,
        message: joinError.message,
        details: joinError.details,
        hint: joinError.hint
      })
      return NextResponse.json(
        { error: `Odaya katılınamadı: ${joinError.message || joinError.code || 'Bilinmeyen hata'}` },
        { status: 500 }
      )
    }

    console.log('Player inserted successfully:', insertedData)

    // Update player count
    const { error: updateError } = await db
      .from('rooms')
      .update({ player_count: room.player_count + 1 })
      .eq('id', roomId)

    if (updateError) {
      console.error('Player count update error:', updateError)
      // Don't fail the join if count update fails, just log it
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Join room unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata'
    return NextResponse.json(
      { error: `Beklenmeyen hata: ${errorMessage}` },
      { status: 500 }
    )
  }
}
