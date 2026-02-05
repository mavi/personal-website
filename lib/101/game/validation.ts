import { Tile, canActAsOkey, getTileValue } from './tiles'
import { MIN_SET_SIZE, MAX_SET_SIZE, MIN_OPENING_SCORE, TileColor, TileNumber, COLORS } from './constants'

export interface SetValidation {
  isValid: boolean
  type: 'run' | 'set' | null
  value: number
  error?: string
}

// Check if tiles form a valid run (same color, consecutive numbers)
export function isValidRun(
  tiles: Tile[], 
  okeyDef: { color: TileColor; number: TileNumber }
): SetValidation {
  if (tiles.length < MIN_SET_SIZE) {
    return { isValid: false, type: null, value: 0, error: 'En az 3 taş olmalı' }
  }

  // Separate jokers and regular tiles
  const jokers = tiles.filter(t => canActAsOkey(t, okeyDef))
  const regularTiles = tiles.filter(t => !canActAsOkey(t, okeyDef))

  if (regularTiles.length === 0) {
    return { isValid: false, type: null, value: 0, error: 'Sadece okey/jokerdan oluşamaz' }
  }

  // All regular tiles must be same color
  const color = regularTiles[0].color
  if (!regularTiles.every(t => t.color === color)) {
    return { isValid: false, type: null, value: 0, error: 'Serideki tüm taşlar aynı renk olmalı' }
  }

  // Sort by number
  const sorted = [...regularTiles].sort((a, b) => a.number - b.number)
  
  // Check for duplicate numbers (same color, same number = invalid for a run)
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].number === sorted[i + 1].number) {
      return { isValid: false, type: null, value: 0, error: 'Seride aynı numara tekrar edemez' }
    }
  }

  // Check for consecutive numbers with jokers filling gaps
  let jokersAvailable = jokers.length
  let totalValue = 0
  let tilesPlaced = 0
  let expectedNumber = sorted[0].number

  for (let i = 0; i < sorted.length; i++) {
    const tile = sorted[i]
    
    // Fill gaps with jokers
    while (tile.number > expectedNumber) {
      if (jokersAvailable === 0) {
        return { isValid: false, type: null, value: 0, error: 'Seri ardışık olmalı' }
      }
      totalValue += expectedNumber
      jokersAvailable--
      tilesPlaced++
      expectedNumber++
    }
    
    if (tile.number !== expectedNumber) {
      return { isValid: false, type: null, value: 0, error: 'Seri ardışık olmalı' }
    }
    
    totalValue += tile.number
    tilesPlaced++
    expectedNumber++
  }

  // Place remaining jokers at the end (if numbers are valid)
  // But only place enough to match the total tile count
  const remainingSlots = tiles.length - tilesPlaced
  let jokersToPlace = Math.min(jokersAvailable, remainingSlots)

  // Try end first
  let endPlaced = 0
  while (jokersToPlace > 0 && expectedNumber <= 13) {
    totalValue += expectedNumber
    expectedNumber++
    jokersToPlace--
    endPlaced++
    tilesPlaced++
  }

  // If still remaining, try beginning
  let startNumber = sorted[0].number - 1
  while (jokersToPlace > 0 && startNumber >= 1) {
    totalValue += startNumber
    startNumber--
    jokersToPlace--
    tilesPlaced++
  }

  // Verify we placed exactly the right number of tiles
  if (tilesPlaced !== tiles.length) {
    return { isValid: false, type: null, value: 0, error: 'Jokerler seride yerleştirilemedi' }
  }

  // Note: 12-13-1 wrapping is NOT allowed in 101 Okey
  // 1 can only be at the start of a sequence

  return { isValid: true, type: 'run', value: totalValue }
}

// Check if tiles form a valid set (same number, different colors)
export function isValidSet(
  tiles: Tile[], 
  okeyDef: { color: TileColor; number: TileNumber }
): SetValidation {
  if (tiles.length < MIN_SET_SIZE || tiles.length > MAX_SET_SIZE) {
    return { 
      isValid: false, 
      type: null, 
      value: 0, 
      error: tiles.length < MIN_SET_SIZE ? 'En az 3 taş olmalı' : 'En fazla 4 taş olabilir' 
    }
  }

  // Separate jokers and regular tiles
  const jokers = tiles.filter(t => canActAsOkey(t, okeyDef))
  const regularTiles = tiles.filter(t => !canActAsOkey(t, okeyDef))

  if (regularTiles.length === 0) {
    return { isValid: false, type: null, value: 0, error: 'Sadece okey/jokerdan oluşamaz' }
  }

  // All regular tiles must have same number
  const number = regularTiles[0].number
  if (!regularTiles.every(t => t.number === number)) {
    return { isValid: false, type: null, value: 0, error: 'Düz perdeki tüm taşlar aynı numara olmalı' }
  }

  // All colors must be different
  const colors = new Set(regularTiles.map(t => t.color))
  if (colors.size !== regularTiles.length) {
    return { isValid: false, type: null, value: 0, error: 'Düz perdeki tüm taşlar farklı renk olmalı' }
  }

  // Check if we have enough different colors for jokers
  const usedColors = new Set(regularTiles.map(t => t.color))
  const availableColors = COLORS.filter(c => !usedColors.has(c))
  
  if (jokers.length > availableColors.length) {
    return { isValid: false, type: null, value: 0, error: 'Çok fazla joker' }
  }

  const totalValue = number * tiles.length

  return { isValid: true, type: 'set', value: totalValue }
}

// Check if a group of tiles forms a valid per (either run or set)
export function validatePer(
  tiles: Tile[], 
  okeyDef: { color: TileColor; number: TileNumber }
): SetValidation {
  const runResult = isValidRun(tiles, okeyDef)
  if (runResult.isValid) return runResult

  const setResult = isValidSet(tiles, okeyDef)
  if (setResult.isValid) return setResult

  return { 
    isValid: false, 
    type: null, 
    value: 0, 
    error: runResult.error || setResult.error || 'Geçersiz kombinasyon' 
  }
}

// Validate opening (minimum 101 points)
export function validateOpening(
  sets: Tile[][], 
  okeyDef: { color: TileColor; number: TileNumber }
): { isValid: boolean; totalValue: number; error?: string } {
  let totalValue = 0
  
  for (const set of sets) {
    const validation = validatePer(set, okeyDef)
    if (!validation.isValid) {
      return { isValid: false, totalValue: 0, error: validation.error }
    }
    totalValue += validation.value
  }

  if (totalValue < MIN_OPENING_SCORE) {
    return { 
      isValid: false, 
      totalValue, 
      error: `Açmak için en az ${MIN_OPENING_SCORE} puan gerekli (şu an: ${totalValue})` 
    }
  }

  return { isValid: true, totalValue }
}

// Check if a tile can be added to an existing per on the table
export function canAddToPer(
  existingPer: Tile[],
  newTile: Tile,
  okeyDef: { color: TileColor; number: TileNumber }
): { canAdd: boolean; position: 'start' | 'end' | null; error?: string } {
  // Try adding at the start
  const withStart = [newTile, ...existingPer]
  if (validatePer(withStart, okeyDef).isValid) {
    return { canAdd: true, position: 'start' }
  }

  // Try adding at the end
  const withEnd = [...existingPer, newTile]
  if (validatePer(withEnd, okeyDef).isValid) {
    return { canAdd: true, position: 'end' }
  }

  return { canAdd: false, position: null, error: 'Bu taş bu pere eklenemez' }
}

// Validate that a player can finish the game
export function canFinishGame(
  remainingTiles: Tile[],
  setsToOpen: Tile[][],
  okeyDef: { color: TileColor; number: TileNumber },
  hasOpened: boolean
): { canFinish: boolean; finishType: 'normal' | 'elden'; error?: string } {
  // If player has only 1 tile left and it will be discarded
  if (remainingTiles.length === 1 && setsToOpen.length === 0) {
    return { canFinish: true, finishType: 'normal' }
  }

  // If all remaining tiles form valid sets (elden finish)
  if (remainingTiles.length > 0 && setsToOpen.length > 0) {
    // Check if player is opening for the first time
    if (!hasOpened) {
      const openingValidation = validateOpening(setsToOpen, okeyDef)
      if (!openingValidation.isValid) {
        return { canFinish: false, finishType: 'normal', error: openingValidation.error }
      }
    } else {
      // Just validate all sets
      for (const set of setsToOpen) {
        const validation = validatePer(set, okeyDef)
        if (!validation.isValid) {
          return { canFinish: false, finishType: 'normal', error: validation.error }
        }
      }
    }

    // Check if all tiles are used in sets
    const tilesInSets = setsToOpen.flat()
    if (tilesInSets.length === remainingTiles.length) {
      return { canFinish: true, finishType: 'elden' }
    }
    
    // If 1 tile remains after sets, it will be discarded
    if (tilesInSets.length === remainingTiles.length - 1) {
      return { canFinish: true, finishType: 'normal' }
    }
  }

  return { canFinish: false, finishType: 'normal', error: 'Oyunu bitirmek için tüm taşları dizmelisiniz' }
}

