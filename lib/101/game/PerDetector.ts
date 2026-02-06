import { Tile } from './tiles'
import { TileColor, TileNumber, COLORS } from './constants'
import { validatePer } from './validation'

export interface DetectedPer {
    tiles: Tile[]
    type: 'run' | 'set'
    value: number
    startIndex: number
    endIndex: number
}

export interface HandAnalysis {
    detectedPers: DetectedPer[]
    totalValue: number
    canOpen: boolean // toplam >= 101
    unassignedTiles: Tile[]
}

/**
 * Ardışık taşları (run) otomatik algılar
 * Örnek: Kırmızı 5-6-7, Mavi 10-11-12-13
 */
export function detectConsecutiveRuns(
    orderedTileIds: string[],
    tiles: Tile[],
    okeyDef: { color: TileColor; number: TileNumber }
): DetectedPer[] {
    const runs: DetectedPer[] = []
    const orderedTiles = orderedTileIds
        .map(id => tiles.find(t => t.id === id))
        .filter((t): t is Tile => t !== undefined)

    if (orderedTiles.length < 3) return runs

    let currentRun: Tile[] = []
    let startIndex = 0

    for (let i = 0; i < orderedTiles.length; i++) {
        const tile = orderedTiles[i]
        const prevTile = currentRun[currentRun.length - 1]

        if (currentRun.length === 0) {
            currentRun = [tile]
            startIndex = i
            continue
        }

        // Check if this tile continues the run
        const canContinue = isConsecutiveInRun(prevTile, tile, okeyDef)

        if (canContinue) {
            currentRun.push(tile)
        } else {
            // End current run if valid (3+ tiles)
            if (currentRun.length >= 3) {
                const validation = validatePer(currentRun, okeyDef)
                if (validation.isValid && validation.type === 'run') {
                    runs.push({
                        tiles: [...currentRun],
                        type: 'run',
                        value: validation.value,
                        startIndex,
                        endIndex: i - 1
                    })
                }
            }
            // Start new run with current tile
            currentRun = [tile]
            startIndex = i
        }
    }

    // Check final run
    if (currentRun.length >= 3) {
        const validation = validatePer(currentRun, okeyDef)
        if (validation.isValid && validation.type === 'run') {
            runs.push({
                tiles: [...currentRun],
                type: 'run',
                value: validation.value,
                startIndex,
                endIndex: orderedTiles.length - 1
            })
        }
    }

    return runs
}

/**
 * Aynı sayı gruplarını (set) otomatik algılar
 * Örnek: 8-8-8 (farklı renkler)
 */
export function detectSets(
    orderedTileIds: string[],
    tiles: Tile[],
    okeyDef: { color: TileColor; number: TileNumber }
): DetectedPer[] {
    const sets: DetectedPer[] = []
    const orderedTiles = orderedTileIds
        .map(id => tiles.find(t => t.id === id))
        .filter((t): t is Tile => t !== undefined)

    if (orderedTiles.length < 3) return sets

    let currentSet: Tile[] = []
    let startIndex = 0
    let targetNumber: TileNumber | null = null

    for (let i = 0; i < orderedTiles.length; i++) {
        const tile = orderedTiles[i]
        const effectiveNumber = getEffectiveNumber(tile, okeyDef)

        if (currentSet.length === 0) {
            currentSet = [tile]
            startIndex = i
            targetNumber = effectiveNumber
            continue
        }

        // Check if same number and different color
        const canAdd = effectiveNumber === targetNumber &&
            !hasSameColor(currentSet, tile, okeyDef)

        if (canAdd && currentSet.length < 4) {
            currentSet.push(tile)
        } else {
            // End current set if valid (3-4 tiles)
            if (currentSet.length >= 3) {
                const validation = validatePer(currentSet, okeyDef)
                if (validation.isValid && validation.type === 'set') {
                    sets.push({
                        tiles: [...currentSet],
                        type: 'set',
                        value: validation.value,
                        startIndex,
                        endIndex: i - 1
                    })
                }
            }
            // Start new set with current tile
            currentSet = [tile]
            startIndex = i
            targetNumber = effectiveNumber
        }
    }

    // Check final set
    if (currentSet.length >= 3) {
        const validation = validatePer(currentSet, okeyDef)
        if (validation.isValid && validation.type === 'set') {
            sets.push({
                tiles: [...currentSet],
                type: 'set',
                value: validation.value,
                startIndex,
                endIndex: orderedTiles.length - 1
            })
        }
    }

    return sets
}

/**
 * Eldeki tüm geçerli perleri ve toplam puanı hesapla
 */
export function analyzeHand(
    orderedTileIds: string[],
    tiles: Tile[],
    okeyDef: { color: TileColor; number: TileNumber }
): HandAnalysis {
    // First try to detect runs (more common in Okey)
    const runs = detectConsecutiveRuns(orderedTileIds, tiles, okeyDef)

    // Get tile IDs that are part of runs
    const runTileIds = new Set(runs.flatMap(r => r.tiles.map(t => t.id)))

    // Filter out run tiles for set detection
    const remainingIds = orderedTileIds.filter(id => !runTileIds.has(id))
    const sets = detectSets(remainingIds, tiles, okeyDef)

    // Get tile IDs that are part of sets
    const setTileIds = new Set(sets.flatMap(s => s.tiles.map(t => t.id)))

    // Unassigned tiles
    const allAssignedIds = new Set([...runTileIds, ...setTileIds])
    const unassignedTiles = tiles.filter(t => !allAssignedIds.has(t.id))

    const detectedPers = [...runs, ...sets]
    const totalValue = detectedPers.reduce((sum, p) => sum + p.value, 0)

    return {
        detectedPers,
        totalValue,
        canOpen: totalValue >= 101,
        unassignedTiles
    }
}

// Helper functions

function isConsecutiveInRun(
    prev: Tile,
    curr: Tile,
    okeyDef: { color: TileColor; number: TileNumber }
): boolean {
    // Handle jokers (they can be any tile)
    if (curr.isJoker || isOkeyTile(curr, okeyDef)) {
        return true // Joker can continue any run
    }
    if (prev.isJoker || isOkeyTile(prev, okeyDef)) {
        return true // Previous was joker, current can be anything
    }

    // Same color and consecutive number
    return prev.color === curr.color && curr.number === prev.number + 1
}

function getEffectiveNumber(
    tile: Tile,
    okeyDef: { color: TileColor; number: TileNumber }
): TileNumber | null {
    if (tile.isJoker) return null // Joker can be any number
    if (isOkeyTile(tile, okeyDef)) return null // Okey can be any number
    return tile.number
}

function hasSameColor(
    tiles: Tile[],
    newTile: Tile,
    okeyDef: { color: TileColor; number: TileNumber }
): boolean {
    if (newTile.isJoker || isOkeyTile(newTile, okeyDef)) return false

    return tiles.some(t => {
        if (t.isJoker || isOkeyTile(t, okeyDef)) return false
        return t.color === newTile.color
    })
}

function isOkeyTile(
    tile: Tile,
    okeyDef: { color: TileColor; number: TileNumber }
): boolean {
    return !tile.isJoker && tile.color === okeyDef.color && tile.number === okeyDef.number
}
