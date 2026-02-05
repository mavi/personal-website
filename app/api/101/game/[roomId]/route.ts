import { NextResponse } from 'next/server'
import { createClient } from '@/lib/101/supabase/server'

// GET - Get current game state
export async function GET(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: gameState } = await db
      .from('game_states')
      .select('*')
      .eq('room_id', roomId)
      .single()

    return NextResponse.json({ gameState: gameState || null })
  } catch (error) {
    console.error('Game state error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
