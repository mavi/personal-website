'use client'

import { useCallback } from 'react'
import { useGameStore } from '../stores/gameStore'

export function useGame(roomId: string) {
  const { selectedTiles, clearSelection } = useGameStore()

  const getAuthToken = () => {
    const sessionData = localStorage.getItem('okey101_session')
    if (!sessionData) throw new Error('Oturum bulunamadı')
    return JSON.parse(sessionData).token
  }

  const drawFromDeck = useCallback(async () => {
    try {
      const token = getAuthToken()

      const response = await fetch(`/api/101/game/${roomId}/draw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ source: 'deck' })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Taş çekilemedi')
      }

      return { success: true, tile: data.tile }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [roomId])

  const drawFromDiscard = useCallback(async () => {
    try {
      const token = getAuthToken()

      const response = await fetch(`/api/101/game/${roomId}/draw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ source: 'discard' })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Taş çekilemedi')
      }

      return { success: true, tile: data.tile }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [roomId])

  const discardTile = useCallback(async (tileId: string) => {
    try {
      const token = getAuthToken()

      const response = await fetch(`/api/101/game/${roomId}/discard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tileId })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Taş atılamadı')
      }

      clearSelection()

      if (data.gameOver) {
        return { success: true, gameOver: true, winner: data.winner, scores: data.scores }
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [roomId, clearSelection])

  const openSets = useCallback(async (tileIds: string[]) => {
    try {
      const token = getAuthToken()

      const response = await fetch(`/api/101/game/${roomId}/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tileIds })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Per açılamadı')
      }

      clearSelection()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }, [roomId, clearSelection])

  return {
    selectedTiles,
    drawFromDeck,
    drawFromDiscard,
    discardTile,
    openSets
  }
}
