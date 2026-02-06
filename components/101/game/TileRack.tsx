'use client'

import { useCallback, useRef, useMemo, useEffect } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import { Tile } from './Tile'
import { useGameStore } from '@/lib/101/stores/gameStore'
import { analyzeHand, type HandAnalysis } from '@/lib/101/game/PerDetector'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

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
    const rackRef = useRef<HTMLDivElement>(null)

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

    // Get ordered tiles
    const orderedTiles = useMemo(() => {
        return handOrder
            .map(id => tiles.find(t => t.id === id))
            .filter((t): t is TileType => t !== undefined)
    }, [handOrder, tiles])

    // Split into two rows
    const half = Math.ceil(orderedTiles.length / 2)
    const topRowTiles = orderedTiles.slice(0, half)
    const bottomRowTiles = orderedTiles.slice(half)

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

    // Handle reorder for top row
    const handleTopRowReorder = useCallback((newOrder: TileType[]) => {
        const newIds = [...newOrder.map(t => t.id), ...bottomRowTiles.map(t => t.id)]
        setHandOrder(newIds)
    }, [bottomRowTiles, setHandOrder])

    // Handle reorder for bottom row
    const handleBottomRowReorder = useCallback((newOrder: TileType[]) => {
        const newIds = [...topRowTiles.map(t => t.id), ...newOrder.map(t => t.id)]
        setHandOrder(newIds)
    }, [topRowTiles, setHandOrder])

    // Handle tile click
    const handleTileClick = useCallback((tileId: string) => {
        if (isMyTurn) {
            onTileClick(tileId)
        }
    }, [isMyTurn, onTileClick])

    const handleDoubleClick = useCallback((tileId: string) => {
        flipTile(tileId)
    }, [flipTile])

    // Per group colors
    const perGroupColors = ['per-group-0', 'per-group-1', 'per-group-2', 'per-group-3', 'per-group-4']

    // Render tile item
    const renderTileItem = (tile: TileType) => {
        const perGroupIndex = tileToPerGroup.get(tile.id)
        const perGroupClass = perGroupIndex !== undefined ? perGroupColors[perGroupIndex % perGroupColors.length] : ''

        return (
            <Reorder.Item
                key={tile.id}
                value={tile}
                className={`rack-tile-item ${perGroupClass}`}
                whileDrag={{ scale: 1.1, zIndex: 50, boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                dragConstraints={rackRef}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                >
                    <Tile
                        tile={tile}
                        selected={selectedTiles.includes(tile.id)}
                        faceDown={flippedTiles.has(tile.id)}
                        onClick={() => handleTileClick(tile.id)}
                        onDoubleClick={() => handleDoubleClick(tile.id)}
                        okeyTile={okeyTile}
                    />
                </motion.div>
            </Reorder.Item>
        )
    }

    return (
        <div ref={rackRef} className="tile-rack-container">
            {/* Top row - Reorderable */}
            <Reorder.Group
                axis="x"
                values={topRowTiles}
                onReorder={handleTopRowReorder}
                className="rack-row"
                layoutScroll
            >
                <AnimatePresence>
                    {topRowTiles.map(tile => renderTileItem(tile))}
                </AnimatePresence>
            </Reorder.Group>

            {/* Bottom row - Reorderable */}
            <Reorder.Group
                axis="x"
                values={bottomRowTiles}
                onReorder={handleBottomRowReorder}
                className="rack-row"
                layoutScroll
            >
                <AnimatePresence>
                    {bottomRowTiles.map(tile => renderTileItem(tile))}
                </AnimatePresence>
            </Reorder.Group>

            {/* Info bar */}
            <motion.div
                className="rack-info-bar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                <span className="tile-count">{tiles.length} taş</span>
                {selectedTiles.length > 0 && (
                    <motion.span
                        className="selected-count"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                    >
                        {selectedTiles.length} seçili
                    </motion.span>
                )}
                {handAnalysis.totalValue > 0 && (
                    <motion.div
                        className={`per-score-badge ${handAnalysis.canOpen ? 'can-open' : ''}`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >
                        <span>{handAnalysis.detectedPers.length} per</span>
                        <span className="score">{handAnalysis.totalValue}p</span>
                    </motion.div>
                )}
            </motion.div>
        </div>
    )
}
