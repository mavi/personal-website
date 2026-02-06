import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token gerekli' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Verify token
    let decoded: { userId: string; username: string }
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string }
    } catch {
      return NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      )
    }

    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get user
    const { data: user, error } = await db
      .from('users')
      .select('id, username, avatar_url, bio, wins, losses, created_at')
      .eq('id', decoded.userId)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Update last_seen for online tracking (ignore errors if column doesn't exist)
    try {
      await db
        .from('users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', decoded.userId)
    } catch {
      // Column may not exist yet - that's fine
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
