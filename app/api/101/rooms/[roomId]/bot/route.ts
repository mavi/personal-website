import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'
import { generateBotId, getBotName, isBot } from '@/lib/101/game/bot'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface RoomRow {
    id: string
    host_id: string
    status: string
    player_count: number
}

interface PlayerRow {
    seat_position: number
    user_id: string
}

// POST - Add a bot to the room
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

        // Check if room exists and user is host
        const { data: roomData, error: roomError } = await db
            .from('rooms')
            .select('id, host_id, status, player_count')
            .eq('id', roomId)
            .single()

        const room = roomData as RoomRow | null

        if (roomError || !room) {
            return NextResponse.json(
                { error: 'Oda bulunamadı' },
                { status: 404 }
            )
        }

        if (room.host_id !== decoded.userId) {
            return NextResponse.json(
                { error: 'Sadece oda sahibi bot ekleyebilir' },
                { status: 403 }
            )
        }

        if (room.status !== 'waiting') {
            return NextResponse.json(
                { error: 'Oyun başladıktan sonra bot eklenemez' },
                { status: 400 }
            )
        }

        if (room.player_count >= 4) {
            return NextResponse.json(
                { error: 'Oda dolu' },
                { status: 400 }
            )
        }

        // Get current players to find empty seat and count bots
        const { data: playersData, error: playersError } = await db
            .from('room_players')
            .select('seat_position, user_id')
            .eq('room_id', roomId)

        if (playersError) {
            console.error('Players fetch error:', playersError)
            return NextResponse.json(
                { error: 'Oyuncular alınamadı' },
                { status: 500 }
            )
        }

        const players = (playersData || []) as PlayerRow[]
        const occupiedSeats = new Set(players.map(p => p.seat_position))

        // Find first empty seat
        let seatPosition = -1
        for (let i = 0; i < 4; i++) {
            if (!occupiedSeats.has(i)) {
                seatPosition = i
                break
            }
        }

        if (seatPosition === -1) {
            return NextResponse.json(
                { error: 'Boş koltuk yok' },
                { status: 400 }
            )
        }

        // Count existing bots to determine bot number
        const existingBots = players.filter(p => isBot(p.user_id))
        const botNumber = existingBots.length + 1
        const botId = generateBotId()
        // Include short ID suffix to ensure uniqueness
        const shortId = botId.slice(-4)
        const botName = `${getBotName(botNumber)}_${shortId}`

        // Create bot user
        const { error: userError } = await db
            .from('users')
            .insert({
                id: botId,
                username: botName,
                password_hash: 'BOT_USER_NO_LOGIN', // Bots can't login - this is not a valid bcrypt hash
                avatar_url: null,
                bio: 'Bot oyuncu',
                wins: 0,
                losses: 0
            })

        if (userError) {
            console.error('Bot user create error:', userError)
            return NextResponse.json(
                { error: 'Bot oluşturulamadı' },
                { status: 500 }
            )
        }

        // Add bot to room
        const { error: joinError } = await db
            .from('room_players')
            .insert({
                room_id: roomId,
                user_id: botId,
                seat_position: seatPosition,
                is_ready: true, // Bots are always ready
                is_connected: true,
                last_seen: new Date().toISOString()
            })

        if (joinError) {
            // Cleanup: delete bot user
            await db.from('users').delete().eq('id', botId)
            console.error('Bot join error:', joinError)
            return NextResponse.json(
                { error: 'Bot odaya eklenemedi' },
                { status: 500 }
            )
        }

        // Update player count
        await db
            .from('rooms')
            .update({ player_count: room.player_count + 1 })
            .eq('id', roomId)

        return NextResponse.json({
            success: true,
            bot: { id: botId, username: botName, seatPosition }
        })
    } catch (error) {
        console.error('Add bot error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}

// DELETE - Remove a bot from the room
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
        const { botId } = await request.json()

        if (!botId || !isBot(botId)) {
            return NextResponse.json(
                { error: 'Geçersiz bot ID' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = supabase as any

        // Check if room exists and user is host
        const { data: roomData, error: roomError } = await db
            .from('rooms')
            .select('id, host_id, status, player_count')
            .eq('id', roomId)
            .single()

        const room = roomData as RoomRow | null

        if (roomError || !room) {
            return NextResponse.json(
                { error: 'Oda bulunamadı' },
                { status: 404 }
            )
        }

        if (room.host_id !== decoded.userId) {
            return NextResponse.json(
                { error: 'Sadece oda sahibi bot çıkarabilir' },
                { status: 403 }
            )
        }

        if (room.status !== 'waiting') {
            return NextResponse.json(
                { error: 'Oyun başladıktan sonra bot çıkarılamaz' },
                { status: 400 }
            )
        }

        // Remove bot from room
        const { error: leaveError } = await db
            .from('room_players')
            .delete()
            .eq('room_id', roomId)
            .eq('user_id', botId)

        if (leaveError) {
            console.error('Bot leave error:', leaveError)
            return NextResponse.json(
                { error: 'Bot çıkarılamadı' },
                { status: 500 }
            )
        }

        // Delete bot user
        await db.from('users').delete().eq('id', botId)

        // Update player count
        await db
            .from('rooms')
            .update({ player_count: Math.max(0, room.player_count - 1) })
            .eq('id', roomId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Remove bot error:', error)
        return NextResponse.json(
            { error: 'Bir hata oluştu' },
            { status: 500 }
        )
    }
}
