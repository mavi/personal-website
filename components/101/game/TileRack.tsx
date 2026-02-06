'use client'

import { useCallback, useRef, useState, useMemo, useEffect } from 'react'
import { Tile } from './Tile'
import { useGameStore } from '@/lib/101/stores/gameStore'
import { analyzeHand, type HandAnalysis } from '@/lib/101/game/PerDetector'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

const SLOTS_PER_ROW = 13
const TOTAL_SLOTS = SLOTS_PER_ROW * 2

interface TileRackProps {
    tiles: TileType[]
    selectedTiles: string[]
    onTileClick: (tileId: string) => void
    onTileDiscard?: (tileId: string) => void
    okeyTile: { color: TileColor; number: TileNumber } | null
    isMyTurn: boolean
    onHandAnalysis?: (analysis: HandAnalysis) => void
}

export function TileRack({ tiles, selectedTiles, onTileClick, okeyTile, isMyTurn, onHandAnalysis }: TileRackProps) {
    const { handOrder, setHandOrder, flippedTiles, flipTile } = useGameStore()
    const [draggedTileId, setDraggedTileId] = useState<string | null>(null)
    const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
    const [touchDragTile, setTouchDragTile] = useState<string | null>(null)
    const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null)

    const slotRefs = useRef<Map<number, HTMLDivElement>>(new Map())
    const rackRef = useRef<HTMLDivElement>(null)
    const longPressTimer = useRef<NodeJS.Timeout | null>(null)

    // Sync hand order when tiles change
    useEffect(() => {
        const tileIds = new Set(tiles.map(t => t.id))
        const existingOrder = handOrder.filter(id => tileIds.has(id))
        const newTiles = tiles.filter(t => !existingOrder.includes(t.id)).map(t => t.id)
        const newOrder = [...existingOrder, ...newTiles]

        if (newOrder.length !== handOrder.length || newOrder.some((id, i) => id !== handOrder[i])) {
            setHandOrder(newOrder)
        }
    }, [tiles]) // eslint-disable-line react-hooks/exhaustive-deps

    // Map tile IDs to slot indices
    const slotToTile = useMemo(() => {
        const map = new Map<number, TileType>()
        handOrder.forEach((tileId, index) => {
            const tile = tiles.find(t => t.id === tileId)
            if (tile && index < TOTAL_SLOTS) {
                map.set(index, tile)
            }
        })
        return map
    }, [handOrder, tiles])

    // Analyze hand for pers
    const handAnalysis = useMemo(() => {
        if (!okeyTile || tiles.length < 3) {
            return { detectedPers: [], totalValue: 0, canOpen: false, unassignedTiles: tiles }
        }
        return analyzeHand(handOrder, tiles, okeyTile)
    }, [handOrder, tiles, okeyTile])

    // Notify parent about hand analysis
    useEffect(() => {
        if (onHandAnalysis) {
            onHandAnalysis(handAnalysis)
        }
    }, [handAnalysis, onHandAnalysis])

    // Create per group map for coloring
    const tileToPerGroup = useMemo(() => {
        const map = new Map<string, number>()
        handAnalysis.detectedPers.forEach((per, groupIndex) => {
            per.tiles.forEach(tile => map.set(tile.id, groupIndex))
        })
        return map
    }, [handAnalysis.detectedPers])

    // Get slot index from screen position
    const getSlotFromPosition = useCallback((clientX: number, clientY: number): number | null => {
        let closestSlot: number | null = null
        let closestDistance = Infinity

        slotRefs.current.forEach((element, slotIndex) => {
            const rect = element.getBoundingClientRect()
            const centerX = rect.left + rect.width / 2
            const centerY = rect.top + rect.height / 2
            const distance = Math.sqrt(Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2))

            if (distance < closestDistance && distance < 60) {
                closestDistance = distance
                closestSlot = slotIndex
            }
        })

        return closestSlot
    }, [])

    // Handle drag start
    const handleDragStart = useCallback((e: React.DragEvent, tileId: string) => {
        setDraggedTileId(tileId)
        e.dataTransfer.setData('text/plain', tileId)
        e.dataTransfer.setData('source', 'rack')
        e.dataTransfer.effectAllowed = 'move'

        // Create custom drag image
        const target = e.currentTarget as HTMLElement
        const clone = target.cloneNode(true) as HTMLElement
        clone.style.transform = 'scale(1.1)'
        clone.style.opacity = '0.9'
        document.body.appendChild(clone)
        e.dataTransfer.setDragImage(clone, 22, 30)
        setTimeout(() => document.body.removeChild(clone), 0)
    }, [])

    // Handle drag over slot
    const handleDragOverSlot = useCallback((e: React.DragEvent, slotIndex: number) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOverSlot(slotIndex)
    }, [])

    // Handle drop on slot
    const handleDrop = useCallback((e: React.DragEvent, targetSlot: number) => {
        e.preventDefault()
        const tileId = e.dataTransfer.getData('text/plain')

        if (!tileId) return

        const currentIndex = handOrder.indexOf(tileId)
        if (currentIndex === -1) return

        // Reorder to move tile to target slot
        const newOrder = [...handOrder]
        newOrder.splice(currentIndex, 1)

        // Insert at target position, accounting for removed element
        const insertIndex = targetSlot > currentIndex ? targetSlot : targetSlot
        newOrder.splice(Math.min(insertIndex, newOrder.length), 0, tileId)

        setHandOrder(newOrder)
        setDraggedTileId(null)
        setDragOverSlot(null)
    }, [handOrder, setHandOrder])

    const handleDragEnd = useCallback(() => {
        setDraggedTileId(null)
        setDragOverSlot(null)
    }, [])

    // Touch handlers
    const handleTouchStart = useCallback((e: React.TouchEvent, tileId: string) => {
        const touch = e.touches[0]
        longPressTimer.current = setTimeout(() => {
            setTouchDragTile(tileId)
            setTouchPosition({ x: touch.clientX, y: touch.clientY })
            if ('vibrate' in navigator) navigator.vibrate(50)
        }, 250)
    }, [])

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchDragTile) {
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current)
                longPressTimer.current = null
            }
            return
        }

        e.preventDefault()
        const touch = e.touches[0]
        setTouchPosition({ x: touch.clientX, y: touch.clientY })

        const slot = getSlotFromPosition(touch.clientX, touch.clientY)
        setDragOverSlot(slot)
    }, [touchDragTile, getSlotFromPosition])

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }

        if (touchDragTile && dragOverSlot !== null) {
            const currentIndex = handOrder.indexOf(touchDragTile)
            if (currentIndex !== -1) {
                const newOrder = [...handOrder]
                newOrder.splice(currentIndex, 1)
                newOrder.splice(Math.min(dragOverSlot, newOrder.length), 0, touchDragTile)
                setHandOrder(newOrder)
            }
        }

        setTouchDragTile(null)
        setTouchPosition(null)
        setDragOverSlot(null)
    }, [touchDragTile, dragOverSlot, handOrder, setHandOrder])

    // Handle tile click
    const handleTileClick = useCallback((tileId: string, e?: React.MouseEvent) => {
        if (e && (e.shiftKey || e.ctrlKey || e.metaKey)) {
            onTileClick(tileId)
        } else if (isMyTurn) {
            onTileClick(tileId)
        }
    }, [isMyTurn, onTileClick])

    const handleDoubleClick = useCallback((tileId: string) => {
        flipTile(tileId)
    }, [flipTile])

    // Per group colors
    const perGroupColors = ['per-group-0', 'per-group-1', 'per-group-2', 'per-group-3', 'per-group-4']

    // Render a single slot
    const renderSlot = (slotIndex: number) => {
        const tile = slotToTile.get(slotIndex)
        const isDragOver = dragOverSlot === slotIndex
        const isDragging = tile && (draggedTileId === tile.id || touchDragTile === tile.id)
        const perGroupIndex = tile ? tileToPerGroup.get(tile.id) : undefined
        const perGroupClass = perGroupIndex !== undefined ? perGroupColors[perGroupIndex % perGroupColors.length] : ''

        return (
            <div
                key={slotIndex}
                ref={(el) => {
                    if (el) slotRefs.current.set(slotIndex, el)
                    else slotRefs.current.delete(slotIndex)
                }}
                className={`rack-slot ${tile ? 'has-tile' : 'empty'} ${isDragOver ? 'drag-over' : ''} ${perGroupClass}`}
                onDragOver={(e) => handleDragOverSlot(e, slotIndex)}
                onDrop={(e) => handleDrop(e, slotIndex)}
                onDragLeave={() => setDragOverSlot(null)}
            >
                {tile && (
                    <div className={`slot-tile ${isDragging ? 'dragging' : ''}`}>
                        <Tile
                            tile={tile}
                            selected={selectedTiles.includes(tile.id)}
                            faceDown={flippedTiles.has(tile.id)}
                            draggable={isMyTurn}
                            isDragging={isDragging}
                            onClick={(e) => handleTileClick(tile.id, e)}
                            onDoubleClick={() => handleDoubleClick(tile.id)}
                            onDragStart={(e) => handleDragStart(e, tile.id)}
                            onDragEnd={handleDragEnd}
                            onTouchStart={(e) => handleTouchStart(e, tile.id)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            okeyTile={okeyTile}
                        />
                    </div>
                )}
            </div>
        )
    }

    // Floating tile for touch drag
    const floatingTile = touchDragTile && touchPosition ? (() => {
        const tile = tiles.find(t => t.id === touchDragTile)
        if (!tile) return null
        return (
            <div
                className="floating-tile"
                style={{ left: touchPosition.x - 22, top: touchPosition.y - 30 }}
            >
                <Tile tile={tile} okeyTile={okeyTile} />
            </div>
        )
    })() : null

    return (
        <div ref={rackRef} className="tile-rack-container">
            {/* Top row */}
            <div className="rack-row">
                {Array.from({ length: SLOTS_PER_ROW }, (_, i) => renderSlot(i))}
            </div>
            {/* Bottom row */}
            <div className="rack-row">
                {Array.from({ length: SLOTS_PER_ROW }, (_, i) => renderSlot(SLOTS_PER_ROW + i))}
            </div>

            {/* Info bar */}
            <div className="rack-info-bar">
                <span className="tile-count">{tiles.length} taş</span>
                {selectedTiles.length > 0 && (
                    <span className="selected-count">{selectedTiles.length} seçili</span>
                )}
                {handAnalysis.totalValue > 0 && (
                    <div className={`per-score-badge ${handAnalysis.canOpen ? 'can-open' : ''}`}>
                        <span>{handAnalysis.detectedPers.length} per</span>
                        <span className="score">{handAnalysis.totalValue}p</span>
                    </div>
                )}
            </div>

            {floatingTile}
        </div>
    )
}
