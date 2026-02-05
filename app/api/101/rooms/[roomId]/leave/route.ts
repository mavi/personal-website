import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface RoomRow {
  host_id: string
  player_count: number
  status: string
  is_paired: boolean
}

interface PlayerRow {
  user_id: string
  seat_position: number
  is_connected: boolean
}

interface GameStateRow {
  hands: Record<string, unknown[]>
  game_phase: string
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

    // If game is currently playing, mark as disconnected instead of removing
    if (room.status === 'playing') {
      // Mark player as disconnected (keep them in room_players so they can rejoin)
      await db
        .from('room_players')
        .update({ is_connected: false })
        .eq('room_id', roomId)
        .eq('user_id', decoded.userId)

      // Check auto-win conditions
      const { data: playersData } = await db
        .from('room_players')
        .select('user_id, seat_position, is_connected')
        .eq('room_id', roomId)

      const players = (playersData || []) as PlayerRow[]
      const connectedPlayers = players.filter(p => p.is_connected)

      // Get game state for auto-win
      const { data: gameStateData } = await db
        .from('game_states')
        .select('*')
        .eq('room_id', roomId)
        .single()

      const gameState = gameStateData as GameStateRow | null

      if (gameState && gameState.game_phase === 'playing') {
        let autoWinner: string | null = null
        let shouldEnd = false

        if (connectedPlayers.length === 0) {
          // All disconnected, end with no winner
          shouldEnd = true
          autoWinner = null
        } else if (room.is_paired) {
          // Paired mode: if both players of a team are disconnected
          const teamA = players.filter(p => p.seat_position === 0 || p.seat_position === 2)
          const teamB = players.filter(p => p.seat_position === 1 || p.seat_position === 3)

          const teamAConnected = teamA.some(p => p.is_connected)
          const teamBConnected = teamB.some(p => p.is_connected)

          if (!teamAConnected && teamBConnected) {
            shouldEnd = true
            autoWinner = connectedPlayers.find(p => p.seat_position === 1 || p.seat_position === 3)?.user_id || null
          } else if (!teamBConnected && teamAConnected) {
            shouldEnd = true
            autoWinner = connectedPlayers.find(p => p.seat_position === 0 || p.seat_position === 2)?.user_id || null
          }
        } else {
          // Solo mode: if only 1 player left
          if (connectedPlayers.length === 1) {
            shouldEnd = true
            autoWinner = connectedPlayers[0].user_id
          }
        }

        if (shouldEnd) {
          await db
            .from('game_states')
            .update({
              game_phase: 'finished',
              winner: autoWinner,
              finish_type: autoWinner ? 'normal' : null,
              updated_at: new Date().toISOString()
            })
            .eq('room_id', roomId)

          await db
            .from('rooms')
            .update({ status: 'finished' })
            .eq('id', roomId)

          // Record match
          const finalScores: Record<string, number> = {}
          for (const p of players) {
            finalScores[p.user_id] = p.user_id === autoWinner ? 0 : 50
          }

          await db
            .from('matches')
            .insert({
              room_id: roomId,
              players: players.map(p => p.user_id),
              final_scores: finalScores,
              winner_id: autoWinner,
              game_mode: room.is_paired ? 'paired' : 'solo',
              finish_type: autoWinner ? 'normal' : null
            })

          // Update stats
          if (autoWinner) {
            for (const p of players) {
              if (p.user_id === autoWinner) {
                await db.rpc('increment_wins', { user_id: p.user_id })
              } else {
                await db.rpc('increment_losses', { user_id: p.user_id })
              }
            }
          }
        }
      }

      return NextResponse.json({ success: true })
    }

    // Room is in waiting or finished state: remove player normally
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
