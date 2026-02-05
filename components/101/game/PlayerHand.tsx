'use client'

import { Tile } from './Tile'
import { sortTiles } from '@/lib/101/game/tiles'
import type { Tile as TileType } from '@/lib/101/game/tiles'
import type { TileColor, TileNumber } from '@/lib/101/game/constants'

interface PlayerHandProps {
  tiles: TileType[]
  selectedTiles: string[]
  onTileClick: (tileId: string) => void
  okeyTile: { color: TileColor; number: TileNumber } | null
  isMyTurn: boolean
}

export function PlayerHand({ tiles, selectedTiles, onTileClick, okeyTile, isMyTurn }: PlayerHandProps) {
  const sortedTiles = sortTiles(tiles)

  return (
    <div className="bg-[#1a2f23]/80 rounded-t-lg px-1">
      <div className="player-hand-scroll">
        {sortedTiles.map((tile) => (
          <Tile
            key={tile.id}
            tile={tile}
            selected={selectedTiles.includes(tile.id)}
            onClick={() => isMyTurn && onTileClick(tile.id)}
            okeyTile={okeyTile}
          />
        ))}
      </div>
      <p className="text-center text-[10px] text-[#a0a0a0] pb-1">
        {tiles.length} taş
        {selectedTiles.length > 0 && <span className="text-[#d4af37] ml-2">{selectedTiles.length} seçili</span>}
      </p>
    </div>
  )
}
