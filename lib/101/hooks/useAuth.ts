'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '../supabase/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false
  })

  // Check session on mount
  useEffect(() => {
    checkSession()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkSession = useCallback(async () => {
    try {
      // Get session from cookie/localStorage
      const sessionData = localStorage.getItem('okey101_session')
      
      if (!sessionData) {
        setState({ user: null, isLoading: false, isAuthenticated: false })
        return
      }

      const { userId, token } = JSON.parse(sessionData)

      // Verify session is still valid
      const response = await fetch('/api/101/auth/session', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const { user } = await response.json()
        setState({ user, isLoading: false, isAuthenticated: true })
      } else {
        localStorage.removeItem('okey101_session')
        setState({ user: null, isLoading: false, isAuthenticated: false })
      }
    } catch (error) {
      console.error('Session check failed:', error)
      setState({ user: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const response = await fetch('/api/101/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Giriş başarısız')
      }

      // Store session
      localStorage.setItem('okey101_session', JSON.stringify({
        userId: data.user.id,
        token: data.token
      }))

      setState({ user: data.user, isLoading: false, isAuthenticated: true })
      return { success: true }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }))
      return { success: false, error: (error as Error).message }
    }
  }, [])

  const register = useCallback(async (username: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      const response = await fetch('/api/101/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kayıt başarısız')
      }

      // Store session
      localStorage.setItem('okey101_session', JSON.stringify({
        userId: data.user.id,
        token: data.token
      }))

      setState({ user: data.user, isLoading: false, isAuthenticated: true })
      return { success: true }
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }))
      return { success: false, error: (error as Error).message }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await fetch('/api/101/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      localStorage.removeItem('okey101_session')
      setState({ user: null, isLoading: false, isAuthenticated: false })
    }
  }, [])

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!state.user) return { success: false, error: 'Giriş yapılmamış' }

    try {
      const sessionData = localStorage.getItem('okey101_session')
      if (!sessionData) throw new Error('Oturum bulunamadı')

      const { token } = JSON.parse(sessionData)

      const response = await fetch('/api/101/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Güncelleme başarısız')
      }

      setState(prev => ({ ...prev, user: data.user }))
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }, [state.user])

  return {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    checkSession
  }
}

