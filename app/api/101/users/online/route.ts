import { NextResponse } from 'next/server'
import { createClient } from '@/lib/101/supabase/server'

interface OnlineUser {
    id: string
    username: string
    avatar_url: string | null
}

// GET - List online users (users who have been active recently)
export async function GET() {
    try {
        const supabase = await createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any

        // Get users who have been active in the last 60 seconds
        const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()

        // Try to get users with last_seen (if column exists)
        let onlineUsers: OnlineUser[] = []

        // First try to get users by last_seen column
        const { data: usersWithLastSeen, error: usersError } = await db
            .from('users')
            .select('id, username, avatar_url, last_seen')
            .gte('last_seen', sixtySecondsAgo)
            .limit(50)

        if (!usersError && usersWithLastSeen && usersWithLastSeen.length > 0) {
            onlineUsers = usersWithLastSeen.map((u: OnlineUser) => ({
                id: u.id,
                username: u.username,
                avatar_url: u.avatar_url
            }))
        } else {
            // Fallback: get users who are in active rooms (room_players with recent last_seen)
            const { data: activePlayers } = await db
                .from('room_players')
                .select(`
          user_id,
          user:users!room_players_user_id_fkey(id, username, avatar_url)
        `)
                .gte('last_seen', sixtySecondsAgo)
                .eq('is_connected', true)

            if (activePlayers) {
                const usersMap = new Map<string, OnlineUser>()
                for (const player of activePlayers) {
                    if (player.user && !usersMap.has(player.user.id)) {
                        usersMap.set(player.user.id, {
                            id: player.user.id,
                            username: player.user.username,
                            avatar_url: player.user.avatar_url
                        })
                    }
                }
                onlineUsers = Array.from(usersMap.values())
            }
        }

        return NextResponse.json({ users: onlineUsers, count: onlineUsers.length })
    } catch (error) {
        console.error('Online users error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}
