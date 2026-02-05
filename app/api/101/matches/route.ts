import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

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

    // Get user's matches
    const { data: matches, error } = await db
      .from('matches')
      .select('*')
      .contains('players', [decoded.userId])
      .order('played_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Matches fetch error:', error)
      return NextResponse.json(
        { error: 'Maç geçmişi yüklenemedi' },
        { status: 500 }
      )
    }

    return NextResponse.json({ matches: matches || [] })
  } catch (error) {
    console.error('Matches error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
