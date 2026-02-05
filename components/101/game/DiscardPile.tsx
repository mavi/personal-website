'use client'

import { Tile } from './Tile'
import type { Tile as TileType } from '@/lib/101/game/tiles'

interface DiscardPileProps {
  tiles: TileType[]
  canDraw: boolean
  onDraw: () => void
}

export function DiscardPile({ tiles, canDraw, onDraw }: DiscardPileProps) {
  const topTile = tiles[tiles.length - 1]

  return (
    <div 
      className={`cursor-pointer transition-transform ${
        canDraw ? 'hover:scale-105' : ''
      }`}
      onClick={() => canDraw && onDraw()}
    >
      <div className="relative">
        {/* Stack effect */}
        {tiles.length > 2 && (
          <div className="absolute -bottom-1 -right-1 w-10 h-14 rounded-md bg-[#e8e4d8] opacity-30" />
        )}
        {tiles.length > 1 && (
          <div className="absolute -bottom-0.5 -right-0.5 w-10 h-14 rounded-md bg-[#e8e4d8] opacity-50" />
        )}
        
        {topTile ? (
          <Tile tile={topTile} />
        ) : (
          <div className="w-10 h-14 rounded-md border-2 border-dashed border-[#1a3a5c] flex items-center justify-center">
            <span className="text-[#1a3a5c] text-xs">Boş</span>
          </div>
        )}
      </div>
      <p className="text-xs text-center mt-1 text-[#8899aa]">
        Çöp ({tiles.length})
      </p>
    </div>
  )
}

