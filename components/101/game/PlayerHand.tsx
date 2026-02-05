'use client'

import { useEffect, useCallback, useRef } from 'react'
import { Tile } from './Tile'
import { useGameStore } from '@/lib/101/stores/gameStore'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

interface PlayerHandProps {
  tiles: TileType[]
  selectedTiles: string[]
  onTileClick: (tileId: string) => void
  onTileDiscard?: (tileId: string) => void
  okeyTile: { color: TileColor; number: TileNumber } | null
  isMyTurn: boolean
}

export function PlayerHand({ tiles, selectedTiles, onTileClick, onTileDiscard, okeyTile, isMyTurn }: PlayerHandProps) {
  const { handOrder, setHandOrder, flippedTiles, flipTile, setDragTile } = useGameStore()
  const dragIndexRef = useRef<number | null>(null)
  const dragOverIndexRef = useRef<number | null>(null)

  // Sync hand order when tiles change
  useEffect(() => {
    const tileIds = new Set(tiles.map(t => t.id))
    // Keep existing order for tiles that still exist, append new ones
    const existingOrder = handOrder.filter(id => tileIds.has(id))
    const newTiles = tiles.filter(t => !existingOrder.includes(t.id)).map(t => t.id)
    const newOrder = [...existingOrder, ...newTiles]
    
    if (newOrder.length !== handOrder.length || 
        newOrder.some((id, i) => id !== handOrder[i])) {
      setHandOrder(newOrder)
    }
  }, [tiles]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get ordered tiles
  const orderedTiles = handOrder
    .map(id => tiles.find(t => t.id === id))
    .filter((t): t is TileType => t !== undefined)

  // Split into two rows
  const half = Math.ceil(orderedTiles.length / 2)
  const topRow = orderedTiles.slice(0, half)
  const bottomRow = orderedTiles.slice(half)

  // Handle click: if holding Shift or Ctrl, select; otherwise flip
  const handleTileClick = useCallback((tileId: string, e?: React.MouseEvent) => {
    if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      // Multi-select mode
      onTileClick(tileId)
    } else if (isMyTurn) {
      // Normal click: toggle selection
      onTileClick(tileId)
    }
  }, [isMyTurn, onTileClick])

  const handleDoubleClick = useCallback((tileId: string) => {
    flipTile(tileId)
  }, [flipTile])

  // Drag handlers for reordering within hand
  const handleDragStart = useCallback((e: React.DragEvent, index: number, tileId: string) => {
    dragIndexRef.current = index
    e.dataTransfer.setData('text/plain', tileId)
    e.dataTransfer.setData('source', 'hand')
    e.dataTransfer.effectAllowed = 'move'
    setDragTile(tileId, 'hand')
  }, [setDragTile])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverIndexRef.current = index
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    
    if (dragIndex !== null && dragIndex !== dropIndex) {
      const newOrder = [...handOrder]
      const [moved] = newOrder.splice(dragIndex, 1)
      newOrder.splice(dropIndex, 0, moved)
      setHandOrder(newOrder)
    }
    
    dragIndexRef.current = null
    dragOverIndexRef.current = null
    setDragTile(null, null)
  }, [handOrder, setHandOrder, setDragTile])

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
    dragOverIndexRef.current = null
    setDragTile(null, null)
  }, [setDragTile])

  const renderTileRow = (row: TileType[], startIndex: number) => (
    <div className="hand-row">
      {row.map((tile, i) => {
        const globalIndex = startIndex + i
        return (
          <div
            key={tile.id}
            onDragOver={(e) => handleDragOver(e, globalIndex)}
            onDrop={(e) => handleDrop(e, globalIndex)}
          >
            <Tile
              tile={tile}
              selected={selectedTiles.includes(tile.id)}
              faceDown={flippedTiles.has(tile.id)}
              draggable={isMyTurn}
              onClick={(e?: React.MouseEvent) => handleTileClick(tile.id, e)}
              onDragStart={(e) => handleDragStart(e, globalIndex, tile.id)}
              onDragEnd={handleDragEnd}
              okeyTile={okeyTile}
            />
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="tile-rack safe-bottom">
      {renderTileRow(topRow, 0)}
      {bottomRow.length > 0 && renderTileRow(bottomRow, half)}
      <div className="flex justify-center items-center gap-2 mt-1">
        <p className="text-center text-[10px] text-white/60">
          {tiles.length} taş
          {selectedTiles.length > 0 && <span className="text-[#d4af37] ml-2">{selectedTiles.length} seçili</span>}
        </p>
      </div>
    </div>
  )
}
