'use client'

import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

interface TileProps {
  tile: TileType
  size?: 'small' | 'normal' | 'large'
  selected?: boolean
  onClick?: () => void
  isOkey?: boolean
  okeyTile?: { color: TileColor; number: TileNumber } | null
}

export function Tile({ tile, size = 'normal', selected, onClick, isOkey, okeyTile }: TileProps) {
  const sizeClasses: Record<string, string> = {
    small: 'okey-tile-sm',
    normal: '',
    large: 'okey-tile-lg'
  }

  // Check if this tile is the okey
  const isOkeyTile = okeyTile &&
    !tile.isJoker &&
    tile.color === okeyTile.color &&
    tile.number === okeyTile.number

  const classes = [
    'okey-tile',
    sizeClasses[size],
    tile.color, // applies .red, .blue, .black, .yellow CSS rules
    selected ? 'selected' : '',
    tile.isJoker ? 'joker' : '',
    (isOkey || isOkeyTile) ? 'okey-highlight' : ''
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} onClick={onClick}>
      {tile.isJoker ? (
        <span style={{ color: '#1f2937' }}>★</span>
      ) : (
        <span className="font-bold">{tile.number}</span>
      )}
      {isOkeyTile && (
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
