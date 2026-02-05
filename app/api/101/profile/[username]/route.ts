import { NextResponse } from 'next/server'
import { createClient } from '@/lib/101/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Get user profile
    const { data: user, error: userError } = await db
      .from('users')
      .select('id, username, avatar_url, bio, wins, losses, created_at')
      .eq('username', username.toLowerCase())
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
    }

    // Get user's match history
    const { data: matches } = await db
      .from('matches')
      .select('*')
      .contains('players', [user.id])
      .order('played_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      user,
      matches: matches || []
    })
  } catch (error) {
    console.error('Profile get error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
