import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

// GET - Get current user's profile
export async function GET(request: Request) {
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

    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

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

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Profile get error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}

// PATCH - Update current user's profile
export async function PATCH(request: Request) {
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

    const updates = await request.json()
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Only allow updating bio and avatar_url
    const allowedUpdates: Record<string, unknown> = {}
    if (updates.bio !== undefined) {
      allowedUpdates.bio = updates.bio.substring(0, 500) // Limit to 500 chars
    }
    if (updates.avatar_url !== undefined) {
      allowedUpdates.avatar_url = updates.avatar_url
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'Güncellenecek alan yok' },
        { status: 400 }
      )
    }

    const { data: user, error } = await db
      .from('users')
      .update(allowedUpdates)
      .eq('id', decoded.userId)
      .select('id, username, avatar_url, bio, wins, losses, created_at')
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json(
        { error: 'Profil güncellenemedi' },
        { status: 500 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Profile patch error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
