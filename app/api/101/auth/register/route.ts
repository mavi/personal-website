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

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Kullanıcı adı en az 3 karakter olmalı' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Şifre en az 6 karakter olmalı' },
        { status: 400 }
      )
    }

    // Check for valid characters in username
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if username already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingData } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single()

    if (existingData) {
      return NextResponse.json(
        { error: 'Bu kullanıcı adı zaten kullanılıyor' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newUserData, error: insertError } = await (supabase as any)
      .from('users')
      .insert({
        username: username.toLowerCase(),
        password_hash: passwordHash,
        wins: 0,
        losses: 0
      })
      .select()
      .single()

    const newUser = newUserData as UserRow | null

    if (insertError || !newUser) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Kullanıcı oluşturulamadı' },
        { status: 500 }
      )
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return user without password hash
    const { password_hash: _, ...userWithoutPassword } = newUser

    return NextResponse.json({
      user: userWithoutPassword,
      token
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    )
  }
}
