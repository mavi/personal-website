import { Tile, createDeck, shuffleDeck, getOkeyTile } from './tiles'
import { 
  STARTING_PLAYER_TILES, 
  OTHER_PLAYER_TILES, 
  TileColor, 
  TileNumber,
  SeatPosition 
} from './constants'

export interface DealResult {
  hands: Record<string, Tile[]>
  deck: Tile[]
  indicator: Tile
  okeyDef: { color: TileColor; number: TileNumber }
}

// Deal tiles to players at game start
export function dealTiles(
  playerIds: string[],
  seatPositions: Record<string, SeatPosition>,
  startingPlayerId: string
): DealResult {
  // Create and shuffle deck
  let deck = shuffleDeck(createDeck())
  
  // Pick indicator tile - must NOT be a joker (re-pick if needed)
  let indicatorIndex = Math.floor(Math.random() * deck.length)
  while (deck[indicatorIndex].isJoker) {
    indicatorIndex = Math.floor(Math.random() * deck.length)
  }
  const indicator = deck[indicatorIndex]
  deck = [...deck.slice(0, indicatorIndex), ...deck.slice(indicatorIndex + 1)]
  
  // Determine okey tile based on indicator
  const okeyDef = getOkeyTile(indicator)
  
  // Deal tiles to each player
  const hands: Record<string, Tile[]> = {}
  
  for (const playerId of playerIds) {
    const tileCount = playerId === startingPlayerId 
      ? STARTING_PLAYER_TILES 
      : OTHER_PLAYER_TILES
    
    hands[playerId] = deck.slice(0, tileCount)
    deck = deck.slice(tileCount)
  }
  
  return {
    hands,
    deck,
    indicator,
    okeyDef
  }
}

// Draw a tile from the deck
// Pass discardPile so we can reshuffle if deck is empty
export function drawFromDeck(
  deck: Tile[],
  discardPile?: Tile[]
): { tile: Tile | null; newDeck: Tile[]; newDiscardPile?: Tile[] } {
  // If deck is empty but discard pile has cards, reshuffle
  if (deck.length === 0 && discardPile && discardPile.length > 1) {
    const { newDeck: reshuffled, newPile } = reshuffleDiscardIntoDeck(deck, discardPile)
    if (reshuffled.length === 0) {
      return { tile: null, newDeck: [], newDiscardPile: newPile }
    }
    const tile = reshuffled[0]
    return { tile, newDeck: reshuffled.slice(1), newDiscardPile: newPile }
  }

  if (deck.length === 0) {
    return { tile: null, newDeck: [] }
  }
  
  const tile = deck[0]
  const newDeck = deck.slice(1)
  
  return { tile, newDeck }
}

// Draw from discard pile (only top tile)
export function drawFromDiscard(discardPile: Tile[]): { tile: Tile | null; newPile: Tile[] } {
  if (discardPile.length === 0) {
    return { tile: null, newPile: [] }
  }
  
  const tile = discardPile[discardPile.length - 1]
  const newPile = discardPile.slice(0, -1)
  
  return { tile, newPile }
}

// Discard a tile
export function discardTile(
  hand: Tile[], 
  tileId: string, 
  discardPile: Tile[]
): { newHand: Tile[]; newPile: Tile[]; discardedTile: Tile | null } {
  const tileIndex = hand.findIndex(t => t.id === tileId)
  
  if (tileIndex === -1) {
    return { newHand: hand, newPile: discardPile, discardedTile: null }
  }
  
  const discardedTile = hand[tileIndex]
  const newHand = [...hand.slice(0, tileIndex), ...hand.slice(tileIndex + 1)]
  const newPile = [...discardPile, discardedTile]
  
  return { newHand, newPile, discardedTile }
}

// Add tile to hand
export function addToHand(hand: Tile[], tile: Tile): Tile[] {
  return [...hand, tile]
}

// Remove tiles from hand (for opening/adding to sets)
export function removeTilesFromHand(hand: Tile[], tileIds: string[]): Tile[] {
  const idsToRemove = new Set(tileIds)
  return hand.filter(t => !idsToRemove.has(t.id))
}

// Check if deck is empty
export function isDeckEmpty(deck: Tile[]): boolean {
  return deck.length === 0
}

// Get number of tiles remaining in deck
export function getDeckCount(deck: Tile[]): number {
  return deck.length
}

// Reshuffle discard pile into deck (if deck runs out)
export function reshuffleDiscardIntoDeck(
  deck: Tile[], 
  discardPile: Tile[]
): { newDeck: Tile[]; newPile: Tile[] } {
  if (discardPile.length <= 1) {
    return { newDeck: deck, newPile: discardPile }
  }
  
  // Keep only the top card in discard pile
  const topCard = discardPile[discardPile.length - 1]
  const cardsToShuffle = discardPile.slice(0, -1)
  
  // Shuffle and add to deck
  const newDeck = shuffleDeck([...deck, ...cardsToShuffle])
  
  return { newDeck, newPile: [topCard] }
}

