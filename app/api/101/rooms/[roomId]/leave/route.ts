import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface RoomRow {
  host_id: string
  player_count: number
}

interface PlayerRow {
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
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get room
    const { data: roomData } = await db
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    const room = roomData as RoomRow | null

    if (!room) {
      return NextResponse.json(
        { error: 'Oda bulunamadı' },
        { status: 404 }
      )
    }

    // Remove player from room
    const { error: leaveError } = await db
      .from('room_players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', decoded.userId)

    if (leaveError) {
      console.error('Leave error:', leaveError)
      return NextResponse.json(
        { error: 'Odadan ayrılınamadı' },
        { status: 500 }
      )
    }

    // If host is leaving, either transfer host or delete room
    if (room.host_id === decoded.userId) {
      // Get remaining players
      const { data: remainingPlayersData } = await db
        .from('room_players')
        .select('user_id')
        .eq('room_id', roomId)
        .limit(1)

      const remainingPlayers = (remainingPlayersData || []) as PlayerRow[]

      if (remainingPlayers.length > 0) {
        // Transfer host to another player
        await db
          .from('rooms')
          .update({ 
            host_id: remainingPlayers[0].user_id,
            player_count: room.player_count - 1
          })
          .eq('id', roomId)
      } else {
        // No players left, delete room
        await db
          .from('rooms')
          .delete()
          .eq('id', roomId)
      }
    } else {
      // Just update player count
      await db
        .from('rooms')
        .update({ player_count: Math.max(0, room.player_count - 1) })
        .eq('id', roomId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Leave room error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
