'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/101/supabase/client'
import type { ChatMessage } from '@/lib/101/supabase/types'

interface ChatBoxProps {
  roomId: string
  userId: string
  username: string
}

interface MessageWithUser extends ChatMessage {
  user?: { username: string }
}

export function ChatBox({ roomId, userId, username }: ChatBoxProps) {
  const [messages, setMessages] = useState<MessageWithUser[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Fetch initial messages
  useEffect(() => {
    fetchMessages()

    // Subscribe to new messages
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
          // Add username for display
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, username])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchMessages = async () => {
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
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || isLoading) return

    setIsLoading(true)
    const messageText = newMessage.trim()
    setNewMessage('')

    const { error } = await db
      .from('chat_messages')
      .insert({
        room_id: roomId,
        user_id: userId,
        message: messageText
      })

    if (error) {
      console.error('Send message error:', error)
      setNewMessage(messageText) // Restore message on error
    }

    setIsLoading(false)
  }

  return (
    <div className="chat-container h-full flex flex-col">
      <div className="p-3 border-b border-[#1a3a5c]">
        <h3 className="font-medium">Sohbet</h3>
      </div>

      <div className="chat-messages flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-center text-[#8899aa] text-sm">
            Henüz mesaj yok
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <span className="chat-message-user">
                {msg.user?.username || 'Anonim'}:
              </span>{' '}
              <span className="text-[#f5f5f5]">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="chat-input p-3 border-t border-[#1a3a5c]">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesaj yazın..."
            className="okey-input flex-1 py-2 text-sm"
            maxLength={200}
          />
          <button
            type="submit"
            disabled={isLoading || !newMessage.trim()}
            className="okey-btn okey-btn-primary px-3 disabled:opacity-50 flex-shrink-0"
          >
            Gönder
          </button>
        </div>
      </form>
    </div>
  )
}
