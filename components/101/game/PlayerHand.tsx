'use client'

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { Tile } from './Tile'
import { useGameStore } from '@/lib/101/stores/gameStore'
import { analyzeHand, type HandAnalysis, type DetectedPer } from '@/lib/101/game/PerDetector'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

interface PlayerHandProps {
  tiles: TileType[]
  selectedTiles: string[]
  onTileClick: (tileId: string) => void
  onTileDiscard?: (tileId: string) => void
  okeyTile: { color: TileColor; number: TileNumber } | null
  isMyTurn: boolean
  onHandAnalysis?: (analysis: HandAnalysis) => void
}

export function PlayerHand({ tiles, selectedTiles, onTileClick, onTileDiscard, okeyTile, isMyTurn, onHandAnalysis }: PlayerHandProps) {
  const { handOrder, setHandOrder, flippedTiles, flipTile, setDragTile } = useGameStore()
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [touchDragTile, setTouchDragTile] = useState<string | null>(null)
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null)

  const dragIndexRef = useRef<number | null>(null)
  const tileRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const rackRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

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

  // Analyze hand for pers (runs and sets)
  const handAnalysis = useMemo(() => {
    if (!okeyTile || orderedTiles.length < 3) {
      return { detectedPers: [], totalValue: 0, canOpen: false, unassignedTiles: orderedTiles }
    }
    return analyzeHand(handOrder, tiles, okeyTile)
  }, [handOrder, tiles, okeyTile, orderedTiles])

  // Notify parent about hand analysis
  useEffect(() => {
    if (onHandAnalysis) {
      onHandAnalysis(handAnalysis)
    }
  }, [handAnalysis, onHandAnalysis])

  // Create a set of tile IDs that are part of detected pers
  const perTileIds = useMemo(() => {
    const ids = new Set<string>()
    handAnalysis.detectedPers.forEach(per => {
      per.tiles.forEach(tile => ids.add(tile.id))
    })
    return ids
  }, [handAnalysis.detectedPers])

  // Map tile ID to its per group index (for coloring)
  const tileToPerGroup = useMemo(() => {
    const map = new Map<string, number>()
    handAnalysis.detectedPers.forEach((per, groupIndex) => {
      per.tiles.forEach(tile => map.set(tile.id, groupIndex))
    })
    return map
  }, [handAnalysis.detectedPers])

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

  // Calculate drop index from position
  const getDropIndexFromPosition = useCallback((clientX: number, clientY: number): number | null => {
    if (!rackRef.current) return null

    const rackRect = rackRef.current.getBoundingClientRect()
    if (clientX < rackRect.left || clientX > rackRect.right ||
      clientY < rackRect.top || clientY > rackRect.bottom) {
      return null
    }

    let closestIndex = 0
    let closestDistance = Infinity

    tileRefs.current.forEach((element, tileId) => {
      const index = orderedTiles.findIndex(t => t.id === tileId)
      if (index === -1) return

      const rect = element.getBoundingClientRect()
      const tileCenter = rect.left + rect.width / 2
      const distance = Math.abs(clientX - tileCenter)

      if (distance < closestDistance) {
        closestDistance = distance
        // If cursor is to the left of center, insert before; otherwise after
        closestIndex = clientX < tileCenter ? index : index + 1
      }
    })

    return closestIndex
  }, [orderedTiles])

  // Drag handlers for reordering within hand
  const handleDragStart = useCallback((e: React.DragEvent, index: number, tileId: string) => {
    dragIndexRef.current = index
    setDraggedTileId(tileId)
    e.dataTransfer.setData('text/plain', tileId)
    e.dataTransfer.setData('source', 'hand')
    e.dataTransfer.effectAllowed = 'move'
    setDragTile(tileId, 'hand')

    // Create drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement
    dragImage.style.opacity = '0.8'
    dragImage.style.transform = 'scale(1.1)'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 20, 28)
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }, [setDragTile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const dropIndex = getDropIndexFromPosition(e.clientX, e.clientY)
    setDropTargetIndex(dropIndex)
  }, [getDropIndexFromPosition])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    const dropIndex = dropTargetIndex

    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const newOrder = [...handOrder]
      const [moved] = newOrder.splice(dragIndex, 1)
      // Adjust insert index if we removed from before the target
      const insertIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex
      newOrder.splice(insertIndex, 0, moved)
      setHandOrder(newOrder)
    }

    dragIndexRef.current = null
    setDraggedTileId(null)
    setDropTargetIndex(null)
    setDragTile(null, null)
  }, [handOrder, setHandOrder, setDragTile, dropTargetIndex])

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
    setDraggedTileId(null)
    setDropTargetIndex(null)
    setDragTile(null, null)
  }, [setDragTile])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the rack entirely
    const rackRect = rackRef.current?.getBoundingClientRect()
    if (rackRect && (
      e.clientX < rackRect.left || e.clientX > rackRect.right ||
      e.clientY < rackRect.top || e.clientY > rackRect.bottom
    )) {
      setDropTargetIndex(null)
    }
  }, [])

  // Touch handlers for mobile drag
  const handleTouchStart = useCallback((e: React.TouchEvent, tileId: string) => {
    const touch = e.touches[0]

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      setTouchDragTile(tileId)
      setTouchPosition({ x: touch.clientX, y: touch.clientY })
      // Vibration feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }
    }, 300)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragTile) {
      // Cancel long press if finger moves
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      return
    }

    e.preventDefault()
    const touch = e.touches[0]
    setTouchPosition({ x: touch.clientX, y: touch.clientY })

    const dropIndex = getDropIndexFromPosition(touch.clientX, touch.clientY)
    setDropTargetIndex(dropIndex)
  }, [touchDragTile, getDropIndexFromPosition])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }

    if (touchDragTile && dropTargetIndex !== null) {
      const dragIndex = orderedTiles.findIndex(t => t.id === touchDragTile)

      if (dragIndex !== -1 && dragIndex !== dropTargetIndex) {
        const newOrder = [...handOrder]
        const [moved] = newOrder.splice(dragIndex, 1)
        const insertIndex = dragIndex < dropTargetIndex ? dropTargetIndex - 1 : dropTargetIndex
        newOrder.splice(insertIndex, 0, moved)
        setHandOrder(newOrder)
      }
    }

    setTouchDragTile(null)
    setTouchPosition(null)
    setDropTargetIndex(null)
  }, [touchDragTile, dropTargetIndex, orderedTiles, handOrder, setHandOrder])

  // Register tile ref
  const setTileRef = useCallback((tileId: string, element: HTMLDivElement | null) => {
    if (element) {
      tileRefs.current.set(tileId, element)
    } else {
      tileRefs.current.delete(tileId)
    }
  }, [])

  // Per group colors for visual distinction
  const perGroupColors = ['per-group-0', 'per-group-1', 'per-group-2', 'per-group-3', 'per-group-4']

  const renderTileRow = (row: TileType[], startIndex: number, isTopRow: boolean) => (
    <div className="hand-row">
      {row.map((tile, i) => {
        const globalIndex = startIndex + i
        const isDragging = draggedTileId === tile.id || touchDragTile === tile.id
        const showDropIndicator = dropTargetIndex !== null &&
          dropTargetIndex === globalIndex &&
          (draggedTileId !== null || touchDragTile !== null)

        const perGroupIndex = tileToPerGroup.get(tile.id)
        const isInPer = perGroupIndex !== undefined
        const perGroupClass = isInPer ? perGroupColors[perGroupIndex % perGroupColors.length] : ''

        return (
          <div
            key={tile.id}
            ref={(el) => setTileRef(tile.id, el)}
            className={`tile-wrapper ${isDragging ? 'tile-dragging-wrapper' : ''} ${perGroupClass}`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
          >
            {showDropIndicator && (
              <div className="drop-indicator drop-indicator-left" />
            )}
            <Tile
              tile={tile}
              selected={selectedTiles.includes(tile.id)}
              faceDown={flippedTiles.has(tile.id)}
              draggable={isMyTurn}
              isDragging={isDragging}
              onClick={(e?: React.MouseEvent) => handleTileClick(tile.id, e)}
              onDoubleClick={() => handleDoubleClick(tile.id)}
              onDragStart={(e) => handleDragStart(e, globalIndex, tile.id)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, tile.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              okeyTile={okeyTile}
            />
          </div>
        )
      })}
      {/* Show drop indicator at the end if needed */}
      {dropTargetIndex === row.length + startIndex && (draggedTileId || touchDragTile) && (
        <div className="drop-indicator drop-indicator-end" />
      )}
    </div>
  )

  // Floating tile for touch drag
  const floatingTile = touchDragTile && touchPosition ? (
    (() => {
      const tile = tiles.find(t => t.id === touchDragTile)
      if (!tile) return null
      return (
        <div
          className="floating-tile"
          style={{
            left: touchPosition.x - 20,
            top: touchPosition.y - 28,
          }}
        >
          <Tile tile={tile} okeyTile={okeyTile} />
        </div>
      )
    })()
  ) : null

  return (
    <div
      ref={rackRef}
      className="tile-rack safe-bottom"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {renderTileRow(topRow, 0, true)}
      {bottomRow.length > 0 && renderTileRow(bottomRow, half, false)}
      <div className="flex justify-center items-center gap-2 mt-1">
        <p className="text-center text-[10px] text-white/60">
          {tiles.length} taş
          {selectedTiles.length > 0 && <span className="text-[#d4af37] ml-2">{selectedTiles.length} seçili</span>}
        </p>
        {/* Per score display */}
        {handAnalysis.totalValue > 0 && (
          <div className={`per-score-badge ${handAnalysis.canOpen ? 'can-open' : ''}`}>
            <span className="per-count">{handAnalysis.detectedPers.length} per</span>
            <span className="per-value">{handAnalysis.totalValue}p</span>
          </div>
        )}
      </div>
      {floatingTile}
    </div>
  )
}
