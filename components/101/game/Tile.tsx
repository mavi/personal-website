'use client'

import { useCallback } from 'react'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

interface TileProps {
  tile: TileType
  size?: 'small' | 'normal' | 'large'
  selected?: boolean
  faceDown?: boolean
  draggable?: boolean
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
  isOkey?: boolean
  okeyTile?: { color: TileColor; number: TileNumber } | null
}

export function Tile({ 
  tile, size = 'normal', selected, faceDown, draggable = false,
  onClick, onDragStart, onDragEnd, isOkey, okeyTile 
}: TileProps) {
  const sizeClasses: Record<string, string> = {
    small: 'okey-tile-sm',
    normal: '',
    large: 'okey-tile-lg'
  }

  const isOkeyTile = okeyTile &&
    !tile.isJoker &&
    tile.color === okeyTile.color &&
    tile.number === okeyTile.number

  const classes = [
    'okey-tile',
    sizeClasses[size],
    tile.color,
    selected ? 'selected' : '',
    tile.isJoker ? 'joker' : '',
    (isOkey || isOkeyTile) ? 'okey-highlight' : '',
    faceDown ? 'face-down' : ''
  ].filter(Boolean).join(' ')

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', tile.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.(e)
  }, [tile.id, onDragStart])

  return (
    <div 
      className={classes} 
      onClick={onClick}
      draggable={draggable && !faceDown}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
    >
      {tile.isJoker ? (
        <span style={{ color: '#1f2937' }}>★</span>
      ) : (
        <>
          <span className="font-bold leading-none">{tile.number}</span>
          <div className="tile-dots">
            <span className="tile-dot" />
            <span className="tile-dot" />
          </div>
        </>
      )}
      {isOkeyTile && !faceDown && (
        <span className="okey-tile-badge">O</span>
      )}
    </div>
  )
}

// Back of tile (for opponent's hand)
export function TileBack({ size = 'normal' }: { size?: 'small' | 'normal' | 'large' }) {
  const sizeClasses: Record<string, string> = {
    small: 'okey-tile-back-sm',
    normal: 'okey-tile-back',
    large: 'okey-tile-back-lg'
  }

  return <div className={sizeClasses[size]} />
}
