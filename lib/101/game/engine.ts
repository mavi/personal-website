import { Tile, hasSevenPairs, hasEnoughPairsForOpening, findPairs, isOkeyTile, validateSevenPairs } from './tiles'
import { validatePer, validateOpening, canAddToPer } from './validation'
import { calculateFinalScores, FinishType, GameMode, PlayerScore } from './scoring'
import { dealTiles, drawFromDeck, addToHand, removeTilesFromHand } from './deck'
import { TileColor, TileNumber, SeatPosition, SEAT_POSITIONS, MAX_PLAYERS } from './constants'

export interface Player {
  id: string
  username: string
  seatPosition: SeatPosition
  isReady: boolean
  hasOpened: boolean
  openedWithPairs: boolean
}

export interface OpenedSet {
  id: string
  playerId: string
  tiles: Tile[]
  type: 'run' | 'set'
}

// Per-player discard: each seat has at most one visible discard tile
export type PlayerDiscards = Record<SeatPosition, Tile | null>

export interface GameEngineState {
  players: Player[]
  hands: Record<string, Tile[]>
  deck: Tile[]
  playerDiscards: PlayerDiscards
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

  // Initialize per-player discards (all null)
  const playerDiscards: PlayerDiscards = { 0: null, 1: null, 2: null, 3: null }

  return {
    players: players.map(p => ({ ...p, hasOpened: false, openedWithPairs: false })),
    hands,
    deck,
    playerDiscards,
    openedSets: [],
    indicator,
    okeyDef,
    currentTurn: startingSeat,
    // Starting player has 22 tiles and must discard first without drawing
    hasDrawnThisTurn: true,
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

// Get the seat position of the player to the left (previous player)
export function getLeftSeat(seatPosition: SeatPosition): SeatPosition {
  return ((seatPosition + 3) % 4) as SeatPosition
}

// Get the seat position of the player to the right (next player)
export function getRightSeat(seatPosition: SeatPosition): SeatPosition {
  return ((seatPosition + 1) % 4) as SeatPosition
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

// Draw tile from left player's discard
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

  const player = getPlayerById(state, playerId)
  if (!player) {
    return { error: 'Oyuncu bulunamadı' }
  }

  // Draw from the left player's discard
  const leftSeat = getLeftSeat(player.seatPosition)
  const discardTile = state.playerDiscards[leftSeat]

  if (!discardTile) {
    return { error: 'Soldaki oyuncunun attığı taş yok' }
  }

  const newHand = addToHand(state.hands[playerId], discardTile)
  const newDiscards = { ...state.playerDiscards, [leftSeat]: null }

  return {
    ...state,
    playerDiscards: newDiscards,
    hands: { ...state.hands, [playerId]: newHand },
    hasDrawnThisTurn: true
  }
}

// Discard a tile to your own discard spot and end turn
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

  const player = getPlayerById(state, playerId)
  if (!player) {
    return { error: 'Oyuncu bulunamadı' }
  }

  const hand = state.hands[playerId]
  const tileIndex = hand.findIndex(t => t.id === tileId)

  if (tileIndex === -1) {
    return { error: 'Taş bulunamadı' }
  }

  const discardedTile = hand[tileIndex]
  const newHand = [...hand.slice(0, tileIndex), ...hand.slice(tileIndex + 1)]

  // Place tile in player's own discard spot
  const newDiscards = { ...state.playerDiscards, [player.seatPosition]: discardedTile }

  // Check if player finished (0 tiles left after discard)
  if (newHand.length === 0) {
    let finishType: FinishType = 'normal'
    if (state.okeyDef && isOkeyTile(discardedTile, state.okeyDef)) {
      finishType = 'okey'
    }

    return finishGame(state, playerId, finishType, newHand, newDiscards)
  }

  // Move to next turn
  const nextTurn = getNextTurn(state.currentTurn)

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    playerDiscards: newDiscards,
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
      state.playerDiscards
    )
  }

  return {
    ...state,
    players: updatedPlayers,
    hands: { ...state.hands, [playerId]: newHand },
    openedSets: [...state.openedSets, ...newOpenedSets]
  }
}

// Add a tile to an existing opened set on the table
export function handleAddToSet(
  state: GameEngineState,
  playerId: string,
  tileId: string,
  setId: string
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
  if (!player || !player.hasOpened) {
    return { error: 'Önce el açmalısınız' }
  }

  // Find the tile in player's hand
  const hand = state.hands[playerId]
  const tile = hand.find(t => t.id === tileId)
  if (!tile) {
    return { error: 'Taş elinizde bulunamadı' }
  }

  // Find the target set
  const setIndex = state.openedSets.findIndex(s => s.id === setId)
  if (setIndex === -1) {
    return { error: 'Per bulunamadı' }
  }

  const targetSet = state.openedSets[setIndex]

  // Check if tile can be added
  const addResult = canAddToPer(targetSet.tiles, tile, state.okeyDef)
  if (!addResult.canAdd) {
    return { error: addResult.error || 'Bu taş bu pere eklenemez' }
  }

  // Add tile to the set
  const newSetTiles = addResult.position === 'start'
    ? [tile, ...targetSet.tiles]
    : [...targetSet.tiles, tile]

  const newOpenedSets = [...state.openedSets]
  newOpenedSets[setIndex] = { ...targetSet, tiles: newSetTiles }

  // Remove tile from hand
  const newHand = hand.filter(t => t.id !== tileId)

  // Check if player finished (elden)
  if (newHand.length === 0) {
    return finishGame(
      { ...state, openedSets: newOpenedSets },
      playerId,
      'elden',
      newHand,
      state.playerDiscards
    )
  }

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    openedSets: newOpenedSets
  }
}

// Check for 7-pair opening (instant win)
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

  const validation = validateSevenPairs(pairs)
  if (!validation.isValid) {
    return { error: validation.error || 'Geçersiz 7 çift' }
  }

  const tileIds = pairs.flat().map(t => t.id)
  const playerHand = state.hands[playerId]
  const playerTileIds = new Set(playerHand.map(t => t.id))

  for (const tileId of tileIds) {
    if (!playerTileIds.has(tileId)) {
      return { error: 'Bu taşlardan bazıları elinizde yok' }
    }
  }

  if (playerHand.length !== 14) {
    return { error: '7 çift açmak için elinizde tam 14 taş olmalı' }
  }

  return finishGame(state, playerId, 'yedi_cift', [], state.playerDiscards)
}

// Finish the game
function finishGame(
  state: GameEngineState,
  winnerId: string,
  finishType: FinishType,
  winnerHand: Tile[],
  playerDiscards: PlayerDiscards
): GameEngineState {
  const winner = getPlayerById(state, winnerId)!

  const playersWithHands = state.players.map(p => ({
    id: p.id,
    seatPosition: p.seatPosition,
    hand: p.id === winnerId ? winnerHand : state.hands[p.id],
    hasOpened: p.hasOpened,
    openedWithPairs: p.openedWithPairs
  }))

  calculateFinalScores(
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
    playerDiscards,
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

  return {
    ...state,
    currentTurn: getNextTurn(state.currentTurn),
    hasDrawnThisTurn: false,
    turnStartTime: new Date()
  }
}

// Open with 5 pairs (counts as opening, but x2 penalty if lost)
export function handleFivePairOpening(
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
  if (!player) {
    return { error: 'Oyuncu bulunamadı' }
  }

  if (player.hasOpened) {
    return { error: 'Zaten açtınız' }
  }

  // Validate 5 pairs
  if (pairs.length !== 5) {
    return { error: '5 çift gerekli' }
  }

  for (const pair of pairs) {
    if (pair.length !== 2) {
      return { error: 'Her çift 2 taş olmalı' }
    }
    if (pair[0].isJoker || pair[1].isJoker) {
      return { error: 'Joker çift için kullanılamaz' }
    }
    if (pair[0].color !== pair[1].color || pair[0].number !== pair[1].number) {
      return { error: 'Çiftler aynı taş olmalı (renk + numara)' }
    }
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

  // Update player's opened status with pairs flag
  const updatedPlayers = state.players.map(p =>
    p.id === playerId ? { ...p, hasOpened: true, openedWithPairs: true } : p
  )

  return {
    ...state,
    players: updatedPlayers
  }
}

// Add tile to opponent's set (işler taş) - gives 101 penalty to the player
export function handleAddToOpponentSet(
  state: GameEngineState,
  playerId: string,
  tileId: string,
  setId: string
): GameEngineState & { islerTasPenalty?: { playerId: string; penalty: number } } | { error: string } {
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
  if (!player || !player.hasOpened) {
    return { error: 'Önce el açmalısınız' }
  }

  // Find the tile in player's hand
  const hand = state.hands[playerId]
  const tile = hand.find(t => t.id === tileId)
  if (!tile) {
    return { error: 'Taş elinizde bulunamadı' }
  }

  // Find the target set
  const setIndex = state.openedSets.findIndex(s => s.id === setId)
  if (setIndex === -1) {
    return { error: 'Per bulunamadı' }
  }

  const targetSet = state.openedSets[setIndex]

  // Check if this is opponent's set
  if (targetSet.playerId === playerId) {
    // If own set, use normal handleAddToSet
    return handleAddToSet(state, playerId, tileId, setId)
  }

  // This is opponent's set - will incur 101 penalty
  const addResult = canAddToPer(targetSet.tiles, tile, state.okeyDef)
  if (!addResult.canAdd) {
    return { error: addResult.error || 'Bu taş bu pere eklenemez' }
  }

  // Add tile to the set
  const newSetTiles = addResult.position === 'start'
    ? [tile, ...targetSet.tiles]
    : [...targetSet.tiles, tile]

  const newOpenedSets = [...state.openedSets]
  newOpenedSets[setIndex] = { ...targetSet, tiles: newSetTiles }

  // Remove tile from hand
  const newHand = hand.filter(t => t.id !== tileId)

  // Return with penalty info
  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    openedSets: newOpenedSets,
    islerTasPenalty: { playerId, penalty: 101 }
  }
}

