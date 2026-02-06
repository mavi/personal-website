import { NextResponse } from 'next/server'
import { createClient } from '@/lib/101/supabase/server'

// GET - List online users (users who are currently in a room with recent activity)
export async function GET() {
    try {
        const supabase = await createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any

        // Get users who have been active in the last 30 seconds (via room_players last_seen)
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()

        const { data: activePlayers, error } = await db
            .from('room_players')
            .select(`
        user_id,
        user:users!room_players_user_id_fkey(id, username, avatar_url),
        room:rooms!room_players_room_id_fkey(id, name, status)
      `)
            .gte('last_seen', thirtySecondsAgo)
            .eq('is_connected', true)

        if (error) {
            console.error('Online users fetch error:', error)
            return NextResponse.json(
                { error: 'Çevrimiçi kullanıcılar yüklenemedi' },
                { status: 500 }
            )
        }

        // Deduplicate users and format response
        const usersMap = new Map<string, { id: string; username: string; avatar_url: string | null; roomName: string | null; roomStatus: string | null }>()

        for (const player of activePlayers || []) {
            if (player.user && !usersMap.has(player.user.id)) {
                usersMap.set(player.user.id, {
                    id: player.user.id,
                    username: player.user.username,
                    avatar_url: player.user.avatar_url,
                    roomName: player.room?.name || null,
                    roomStatus: player.room?.status || null
                })
            }
        }

        const onlineUsers = Array.from(usersMap.values())

        return NextResponse.json({ users: onlineUsers, count: onlineUsers.length })
    } catch (error) {
        console.error('Online users error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}
