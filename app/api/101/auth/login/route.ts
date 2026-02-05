import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createClient } from '@/lib/101/supabase/server'

const JWT_SECRET = process.env.JWT_SECRET || 'okey101-secret-key-change-in-production'

interface UserRow {
  id: string
  username: string
  password_hash: string
  avatar_url: string | null
  bio: string | null
  wins: number
  losses: number
  created_at: string
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Kullanıcı adı ve şifre gerekli' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Find user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: findError } = await (supabase as any)
      .from('users')
      .select('id, username, password_hash, avatar_url, bio, wins, losses, created_at')
      .eq('username', username.toLowerCase())
      .single()

    const user = data as UserRow | null

    if (findError || !user) {
      return NextResponse.json(
        { error: 'Kullanıcı adı veya şifre hatalı' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Kullanıcı adı veya şifre hatalı' },
        { status: 401 }
      )
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return user without password hash
    const { password_hash: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
