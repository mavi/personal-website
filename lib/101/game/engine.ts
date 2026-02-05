import { Tile, hasSevenPairs, hasEnoughPairsForOpening, findPairs, isOkeyTile, validateSevenPairs } from './tiles'
import { validatePer, validateOpening, canFinishGame } from './validation'
import { calculateFinalScores, FinishType, GameMode, PlayerScore } from './scoring'
import { dealTiles, drawFromDeck, drawFromDiscard, discardTile, addToHand, removeTilesFromHand } from './deck'
import { TileColor, TileNumber, SeatPosition, SEAT_POSITIONS, MAX_PLAYERS } from './constants'

export interface Player {
  id: string
  username: string
  seatPosition: SeatPosition
  isReady: boolean
  hasOpened: boolean
}

export interface OpenedSet {
  id: string
  playerId: string
  tiles: Tile[]
  type: 'run' | 'set'
}

export interface GameEngineState {
  players: Player[]
  hands: Record<string, Tile[]>
  deck: Tile[]
  discardPile: Tile[]
  openedSets: OpenedSet[]
  indicator: Tile | null
  okeyDef: { color: TileColor; number: TileNumber } | null
  currentTurn: SeatPosition
  hasDrawnThisTurn: boolean
  gamePhase: 'waiting' | 'playing' | 'finished'
  winner: string | null
  finishType: FinishType | null
  gameMode: GameMode
  isFolding: boolean
  turnStartTime: Date | null
}

// Initialize a new game
export function initializeGame(
  players: Player[],
  gameMode: GameMode,
  isFolding: boolean
): GameEngineState {
  if (players.length !== MAX_PLAYERS) {
    throw new Error(`Oyun ${MAX_PLAYERS} oyuncu gerektirir`)
  }

  // Determine starting player (random)
  const startingSeat = SEAT_POSITIONS[Math.floor(Math.random() * SEAT_POSITIONS.length)]
  const startingPlayer = players.find(p => p.seatPosition === startingSeat)!

  // Create player ID to seat mapping
  const seatPositions: Record<string, SeatPosition> = {}
  players.forEach(p => {
    seatPositions[p.id] = p.seatPosition
  })

  // Deal tiles
  const { hands, deck, indicator, okeyDef } = dealTiles(
    players.map(p => p.id),
    seatPositions,
    startingPlayer.id
  )

  return {
    players: players.map(p => ({ ...p, hasOpened: false })),
    hands,
    deck,
    discardPile: [],
    openedSets: [],
    indicator,
    okeyDef,
    currentTurn: startingSeat,
    hasDrawnThisTurn: false,
    gamePhase: 'playing',
    winner: null,
    finishType: null,
    gameMode,
    isFolding,
    turnStartTime: new Date()
  }
}

// Get current player
export function getCurrentPlayer(state: GameEngineState): Player | undefined {
  return state.players.find(p => p.seatPosition === state.currentTurn)
}

// Get player by ID
export function getPlayerById(state: GameEngineState, playerId: string): Player | undefined {
  return state.players.find(p => p.id === playerId)
}

// Check if it's a player's turn
export function isPlayerTurn(state: GameEngineState, playerId: string): boolean {
  const player = getPlayerById(state, playerId)
  return player?.seatPosition === state.currentTurn
}

// Draw tile from deck
export function handleDrawFromDeck(
  state: GameEngineState,
  playerId: string
): GameEngineState | { error: string } {
  if (!isPlayerTurn(state, playerId)) {
    return { error: 'Sıra sizde değil' }
  }
  
  if (state.hasDrawnThisTurn) {
    return { error: 'Bu turda zaten taş çektiniz' }
  }
  
  if (state.gamePhase !== 'playing') {
    return { error: 'Oyun aktif değil' }
  }

  const { tile, newDeck } = drawFromDeck(state.deck)
  
  if (!tile) {
    return { error: 'Deste boş' }
  }

  const newHand = addToHand(state.hands[playerId], tile)
  
  return {
    ...state,
    deck: newDeck,
    hands: { ...state.hands, [playerId]: newHand },
    hasDrawnThisTurn: true
  }
}

// Draw tile from discard pile
export function handleDrawFromDiscard(
  state: GameEngineState,
  playerId: string
): GameEngineState | { error: string } {
  if (!isPlayerTurn(state, playerId)) {
    return { error: 'Sıra sizde değil' }
  }
  
  if (state.hasDrawnThisTurn) {
    return { error: 'Bu turda zaten taş çektiniz' }
  }
  
  if (state.gamePhase !== 'playing') {
    return { error: 'Oyun aktif değil' }
  }
  
  if (state.discardPile.length === 0) {
    return { error: 'Çöp boş' }
  }

  const { tile, newPile } = drawFromDiscard(state.discardPile)
  
  if (!tile) {
    return { error: 'Çöp boş' }
  }

  const newHand = addToHand(state.hands[playerId], tile)
  
  return {
    ...state,
    discardPile: newPile,
    hands: { ...state.hands, [playerId]: newHand },
    hasDrawnThisTurn: true
  }
}

// Discard a tile and end turn
export function handleDiscard(
  state: GameEngineState,
  playerId: string,
  tileId: string
): GameEngineState | { error: string } {
  if (!isPlayerTurn(state, playerId)) {
    return { error: 'Sıra sizde değil' }
  }
  
  if (!state.hasDrawnThisTurn) {
    return { error: 'Önce taş çekmelisiniz' }
  }
  
  if (state.gamePhase !== 'playing') {
    return { error: 'Oyun aktif değil' }
  }

  const { newHand, newPile, discardedTile } = discardTile(
    state.hands[playerId],
    tileId,
    state.discardPile
  )
  
  if (!discardedTile) {
    return { error: 'Taş bulunamadı' }
  }

  // Check if player finished (0 tiles left after discard)
  if (newHand.length === 0) {
    // Determine finish type
    let finishType: FinishType = 'normal'
    if (state.okeyDef && isOkeyTile(discardedTile, state.okeyDef)) {
      finishType = 'okey'
    }
    
    return finishGame(state, playerId, finishType, newHand, newPile)
  }

  // Move to next turn
  const nextTurn = getNextTurn(state.currentTurn)
  
  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    discardPile: newPile,
    currentTurn: nextTurn,
    hasDrawnThisTurn: false,
    turnStartTime: new Date()
  }
}

// Open sets on the table
export function handleOpenSets(
  state: GameEngineState,
  playerId: string,
  sets: Tile[][]
): GameEngineState | { error: string } {
  if (!isPlayerTurn(state, playerId)) {
    return { error: 'Sıra sizde değil' }
  }
  
  if (state.gamePhase !== 'playing') {
    return { error: 'Oyun aktif değil' }
  }
  
  if (!state.okeyDef) {
    return { error: 'Okey tanımlı değil' }
  }

  const player = getPlayerById(state, playerId)
  if (!player) {
    return { error: 'Oyuncu bulunamadı' }
  }

  // Validate all sets
  for (const set of sets) {
    const validation = validatePer(set, state.okeyDef)
    if (!validation.isValid) {
      return { error: validation.error || 'Geçersiz per' }
    }
  }

  // If player hasn't opened yet, check for minimum 101 points
  if (!player.hasOpened) {
    const openingValidation = validateOpening(sets, state.okeyDef)
    if (!openingValidation.isValid) {
      return { error: openingValidation.error || 'Açmak için en az 101 puan gerekli' }
    }
  }

  // Get all tile IDs being opened
  const tileIdsToOpen = sets.flat().map(t => t.id)
  
  // Verify player has all these tiles
  const playerHand = state.hands[playerId]
  const playerTileIds = new Set(playerHand.map(t => t.id))
  
  for (const tileId of tileIdsToOpen) {
    if (!playerTileIds.has(tileId)) {
      return { error: 'Bu taşlardan bazıları elinizde yok' }
    }
  }

  // Remove tiles from hand
  const newHand = removeTilesFromHand(playerHand, tileIdsToOpen)

  // Create opened sets
  const newOpenedSets: OpenedSet[] = sets.map((tiles, index) => ({
    id: `${playerId}-${Date.now()}-${index}`,
    playerId,
    tiles,
    type: validatePer(tiles, state.okeyDef!).type!
  }))

  // Update player's opened status
  const updatedPlayers = state.players.map(p => 
    p.id === playerId ? { ...p, hasOpened: true } : p
  )

  // Check if player finished (elden)
  if (newHand.length === 0) {
    return finishGame(
      { ...state, openedSets: [...state.openedSets, ...newOpenedSets] },
      playerId,
      'elden',
      newHand,
      state.discardPile
    )
  }

  return {
    ...state,
    players: updatedPlayers,
    hands: { ...state.hands, [playerId]: newHand },
    openedSets: [...state.openedSets, ...newOpenedSets]
  }
}

// Check for 7-pair opening (instant win)
// pairs: array of 7 pairs, each pair is [tile, tile]
export function handleSevenPairOpening(
  state: GameEngineState,
  playerId: string,
  pairs: Tile[][]
): GameEngineState | { error: string } {
  if (!isPlayerTurn(state, playerId)) {
    return { error: 'Sıra sizde değil' }
  }
  
  if (state.gamePhase !== 'playing') {
    return { error: 'Oyun aktif değil' }
  }

  const player = getPlayerById(state, playerId)
  if (!player || player.hasOpened) {
    return { error: 'Zaten açtınız veya oyuncu bulunamadı' }
  }

  // Use the shared validator
  const validation = validateSevenPairs(pairs)
  if (!validation.isValid) {
    return { error: validation.error || 'Geçersiz 7 çift' }
  }

  // Verify player has all these tiles
  const tileIds = pairs.flat().map(t => t.id)
  const playerHand = state.hands[playerId]
  const playerTileIds = new Set(playerHand.map(t => t.id))
  
  for (const tileId of tileIds) {
    if (!playerTileIds.has(tileId)) {
      return { error: 'Bu taşlardan bazıları elinizde yok' }
    }
  }

  // Player must have exactly 14 tiles (7 pairs)
  if (playerHand.length !== 14) {
    return { error: '7 çift açmak için elinizde tam 14 taş olmalı' }
  }

  // 7 pairs = instant win with x2 multiplier
  return finishGame(state, playerId, 'yedi_cift', [], state.discardPile)
}

// Finish the game
function finishGame(
  state: GameEngineState,
  winnerId: string,
  finishType: FinishType,
  winnerHand: Tile[],
  discardPile: Tile[]
): GameEngineState {
  const winner = getPlayerById(state, winnerId)!
  
  // Calculate final scores
  const playersWithHands = state.players.map(p => ({
    id: p.id,
    seatPosition: p.seatPosition,
    hand: p.id === winnerId ? winnerHand : state.hands[p.id]
  }))

  const scores = calculateFinalScores(
    playersWithHands,
    winnerId,
    winner.seatPosition,
    finishType,
    state.gameMode,
    state.okeyDef!
  )

  return {
    ...state,
    hands: { ...state.hands, [winnerId]: winnerHand },
    discardPile,
    gamePhase: 'finished',
    winner: winnerId,
    finishType
  }
}

// Get next turn (clockwise)
function getNextTurn(currentTurn: SeatPosition): SeatPosition {
  return ((currentTurn + 1) % 4) as SeatPosition
}

// Skip turn (for timeout)
export function handleTimeout(state: GameEngineState): GameEngineState {
  if (state.gamePhase !== 'playing') {
    return state
  }

  const currentPlayer = getCurrentPlayer(state)
  if (!currentPlayer) {
    return state
  }

  // If player hasn't drawn, auto-draw from deck
  if (!state.hasDrawnThisTurn) {
    const drawResult = handleDrawFromDeck(state, currentPlayer.id)
    if ('error' in drawResult) {
      // If can't draw, just skip turn
      return {
        ...state,
        currentTurn: getNextTurn(state.currentTurn),
        hasDrawnThisTurn: false,
        turnStartTime: new Date()
      }
    }
    state = drawResult
  }

  // Auto-discard random tile
  const hand = state.hands[currentPlayer.id]
  if (hand.length > 0) {
    const randomTileId = hand[Math.floor(Math.random() * hand.length)].id
    const discardResult = handleDiscard(state, currentPlayer.id, randomTileId)
    if (!('error' in discardResult)) {
      return discardResult
    }
  }

  // If all else fails, just move to next turn
  return {
    ...state,
    currentTurn: getNextTurn(state.currentTurn),
    hasDrawnThisTurn: false,
    turnStartTime: new Date()
  }
}

