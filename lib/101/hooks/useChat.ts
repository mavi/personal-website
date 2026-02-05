'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '../supabase/client'
import type { ChatMessage } from '../supabase/types'

interface MessageWithUser extends ChatMessage {
  user?: { username: string }
}

export function useChat(roomId: string, userId: string, username: string) {
  const [messages, setMessages] = useState<MessageWithUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch initial messages
  const fetchMessages = useCallback(async () => {
    const { data, error } = await db
      .from('chat_messages')
      .select(`
        *,
        user:users(username)
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!error && data) {
      setMessages(data as MessageWithUser[])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // Subscribe to new messages
  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`
        },
        (payload) => {
          const newMsg = payload.new as MessageWithUser
          if (newMsg.user_id === userId) {
            newMsg.user = { username }
          }
          setMessages(prev => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, userId, username, supabase, fetchMessages])

  // Send a message
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return { success: false }

    setIsLoading(true)
    setError(null)

    const { error } = await db
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: message.trim()
      })

    setIsLoading(false)

    if (error) {
      setError('Mesaj gönderilemedi')
      return { success: false, error: error.message }
    }

    return { success: true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId])

  return {
    messages,
    isLoading,
    error,
    sendMessage
  }
}

