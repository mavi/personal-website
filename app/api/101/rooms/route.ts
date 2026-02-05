import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

// GET - List all available rooms
export async function GET() {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: rooms, error } = await db
      .from('rooms')
      .select(`
        *,
        host:users!rooms_host_id_fkey(username, avatar_url)
      `)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Rooms fetch error:', error)
      return NextResponse.json(
        { error: 'Odalar yüklenemedi' },
        { status: 500 }
      )
    }

    return NextResponse.json({ rooms: rooms || [] })
  } catch (error) {
    console.error('Rooms error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}

// POST - Create a new room
export async function POST(request: Request) {
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

    const { name, isPaired, isFolding, password } = await request.json()

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Oda adı en az 2 karakter olmalı' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Check if user is already in a room
    const { data: existingPlayer } = await db
      .from('room_players')
      .select('room_id')
      .eq('user_id', decoded.userId)
      .single()

    if (existingPlayer) {
      return NextResponse.json(
        { error: 'Zaten bir odadasınız' },
        { status: 400 }
      )
    }

    // Create room
    const { data: room, error: roomError } = await db
      .from('rooms')
      .insert({
        name: name.trim(),
        host_id: decoded.userId,
        is_paired: isPaired ?? false,
        is_folding: isFolding ?? false,
        password: password ? password.trim() : null,
        status: 'waiting',
        player_count: 1
      })
      .select()
      .single()

    if (roomError) {
      console.error('Room create error:', roomError)
      return NextResponse.json(
        { error: 'Oda oluşturulamadı' },
        { status: 500 }
      )
    }

    // Add host as first player
    const { error: playerError } = await db
      .from('room_players')
      .insert({
        room_id: room.id,
        user_id: decoded.userId,
        seat_position: 0,
        is_ready: false
      })

    if (playerError) {
      // Rollback room creation
      await db.from('rooms').delete().eq('id', room.id)
      console.error('Player add error:', playerError)
      return NextResponse.json(
        { error: 'Odaya katılınamadı' },
        { status: 500 }
      )
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error('Create room error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
