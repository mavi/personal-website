import {
  COLORS,
  TILE_NUMBERS,
  TILES_PER_SET,
  JOKER_COUNT,
  TileColor,
  TileNumber
} from './constants'

export interface Tile {
  id: string
  color: TileColor
  number: TileNumber
  isJoker: boolean
}

// Generate a unique tile ID
function generateTileId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// Create a single tile
export function createTile(color: TileColor, number: TileNumber, isJoker = false): Tile {
  return {
    id: generateTileId(),
    color,
    number,
    isJoker
  }
}

// Create the full deck of 106 tiles
export function createDeck(): Tile[] {
  const deck: Tile[] = []

  // Create regular tiles: 4 colors x 13 numbers x 2 sets = 104 tiles
  for (let set = 0; set < TILES_PER_SET; set++) {
    for (const color of COLORS) {
      for (const number of TILE_NUMBERS) {
        deck.push(createTile(color, number))
      }
    }
  }

  // Add 2 joker tiles (we use 'red' color and 0 as placeholder, but isJoker is true)
  for (let i = 0; i < JOKER_COUNT; i++) {
    deck.push({
      id: generateTileId(),
      color: 'red', // Jokers can be any color visually
      number: 1, // Placeholder number
      isJoker: true
    })
  }

  return deck
}

// Shuffle the deck using Fisher-Yates algorithm
export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Get the okey tile based on the indicator
export function getOkeyTile(indicator: Tile): { color: TileColor; number: TileNumber } {
  // Okey is the indicator's number + 1
  // If indicator is 13, okey is 1 (wraps around)
  const okeyNumber = indicator.number === 13 ? 1 : (indicator.number + 1) as TileNumber
  return {
    color: indicator.color,
    number: okeyNumber
  }
}

// Check if a tile is the okey (matches the okey definition)
export function isOkeyTile(tile: Tile, okeyDef: { color: TileColor; number: TileNumber }): boolean {
  if (tile.isJoker) return false // Jokers are "sahte okey", not the real okey
  return tile.color === okeyDef.color && tile.number === okeyDef.number
}

// Check if a tile can act as okey (either real okey or joker)
export function canActAsOkey(tile: Tile, okeyDef: { color: TileColor; number: TileNumber }): boolean {
  return tile.isJoker || isOkeyTile(tile, okeyDef)
}

// Get the point value of a tile
export function getTileValue(tile: Tile, isInHand = true, okeyDef?: { color: TileColor; number: TileNumber }): number {
  // If tile is joker and in hand, it's scored as the okey tile's value
  if (tile.isJoker) {
    // Joker (sahte okey) in hand is worth the okey tile's number value
    return okeyDef?.number ?? 1
  }

  // If it's the okey tile and left in hand, it's worth 25 points
  if (isInHand && okeyDef && isOkeyTile(tile, okeyDef)) {
    return 25
  }

  // Regular tiles are worth their number
  return tile.number
}

// Calculate total hand value
export function calculateHandValue(
  tiles: Tile[],
  okeyDef: { color: TileColor; number: TileNumber }
): number {
  return tiles.reduce((sum, tile) => {
    if (tile.isJoker) {
      // Joker (sahte okey) left in hand: scored as the okey tile's value
      return sum + okeyDef.number
    }
    if (isOkeyTile(tile, okeyDef)) {
      return sum + 25 // Real okey in hand = 25 points
    }
    return sum + tile.number
  }, 0)
}

// Sort tiles by color then number
export function sortTiles(tiles: Tile[]): Tile[] {
  const colorOrder: Record<TileColor, number> = {
    red: 0,
    blue: 1,
    black: 2,
    yellow: 3
  }

  return [...tiles].sort((a, b) => {
    // Jokers go to the end
    if (a.isJoker && !b.isJoker) return 1
    if (!a.isJoker && b.isJoker) return -1
    if (a.isJoker && b.isJoker) return 0

    // Sort by color first
    if (colorOrder[a.color] !== colorOrder[b.color]) {
      return colorOrder[a.color] - colorOrder[b.color]
    }

    // Then by number
    return a.number - b.number
  })
}

// Find pairs in a hand (for pair opening check)
export function findPairs(tiles: Tile[]): Tile[][] {
  const pairs: Tile[][] = []
  const used = new Set<string>()

  for (let i = 0; i < tiles.length; i++) {
    if (used.has(tiles[i].id) || tiles[i].isJoker) continue

    for (let j = i + 1; j < tiles.length; j++) {
      if (used.has(tiles[j].id) || tiles[j].isJoker) continue

      // Check if same color and number (exact pair)
      if (tiles[i].color === tiles[j].color && tiles[i].number === tiles[j].number) {
        pairs.push([tiles[i], tiles[j]])
        used.add(tiles[i].id)
        used.add(tiles[j].id)
        break
      }
    }
  }

  return pairs
}

// Check if hand has enough pairs for opening (5 pairs)
export function hasEnoughPairsForOpening(tiles: Tile[]): boolean {
  const pairs = findPairs(tiles)
  return pairs.length >= 5
}

// Check if hand has 7 pairs (instant win)
// The hand must consist of exactly 7 pairs = 14 tiles, all used
export function hasSevenPairs(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false
  const pairs = findPairs(tiles)
  return pairs.length >= 7
}

// Check if a given set of pairs (submitted explicitly) forms a valid 7-pair opening
export function validateSevenPairs(pairs: Tile[][]): { isValid: boolean; error?: string } {
  if (pairs.length !== 7) {
    return { isValid: false, error: '7 çift gerekli' }
  }

  for (const pair of pairs) {
    if (pair.length !== 2) {
      return { isValid: false, error: 'Her çift 2 taş olmalı' }
    }
    if (pair[0].isJoker || pair[1].isJoker) {
      return { isValid: false, error: 'Joker çift için kullanılamaz' }
    }
    if (pair[0].color !== pair[1].color || pair[0].number !== pair[1].number) {
      return { isValid: false, error: 'Çiftler aynı taş olmalı (renk + numara)' }
    }
  }

  return { isValid: true }
}

