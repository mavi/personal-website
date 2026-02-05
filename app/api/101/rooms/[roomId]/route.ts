import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

// GET - Get room details with players
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: room, error: roomError } = await db
      .from('rooms')
      .select(`
        *,
        host:users!rooms_host_id_fkey(username, avatar_url)
      `)
      .eq('id', roomId)
      .single()

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Oda bulunamadı' },
        { status: 404 }
      )
    }

    // Get players in the room
    const { data: players, error: playersError } = await db
      .from('room_players')
      .select(`
        *,
        user:users(username, avatar_url)
      `)
      .eq('room_id', roomId)
      .order('seat_position', { ascending: true })

    if (playersError) {
      console.error('Players fetch error:', playersError)
    }

    return NextResponse.json({
      room: {
        ...room,
        players: players || []
      }
    })
  } catch (error) {
    console.error('Room get error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}

// DELETE - Close room (host only)
export async function DELETE(
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

    // Check if user is the host
    const { data: room } = await db
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .single()

    if (!room || room.host_id !== decoded.userId) {
      return NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      )
    }

    // Delete room (will cascade to room_players)
    const { error } = await db
      .from('rooms')
      .delete()
      .eq('id', roomId)

    if (error) {
      console.error('Room delete error:', error)
      return NextResponse.json(
        { error: 'Oda silinemedi' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Room delete error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
