// Okey 101 Game Constants

export const COLORS = ['red', 'blue', 'black', 'yellow'] as const
export type TileColor = typeof COLORS[number]

export const TILE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const
export type TileNumber = typeof TILE_NUMBERS[number]

// Total tiles in the game
export const TOTAL_TILES = 106 // 4 colors x 13 numbers x 2 sets + 2 jokers

// Tiles per set (each color-number combination appears twice)
export const TILES_PER_SET = 2

// Number of joker tiles
export const JOKER_COUNT = 2

// Initial tile distribution
export const STARTING_PLAYER_TILES = 22 // First player gets 22
export const OTHER_PLAYER_TILES = 21 // Others get 21

// Game rules
export const MIN_OPENING_SCORE = 101 // Minimum points to open
export const MIN_SET_SIZE = 3 // Minimum tiles in a set/run
export const MAX_SET_SIZE = 4 // Maximum tiles in a group (same number, different colors)

// Special openings
export const PAIRS_FOR_OPENING = 5 // 5 pairs to open
export const PAIRS_FOR_INSTANT_WIN = 7 // 7 pairs = instant win with x2

// Scoring
export const OKEY_PENALTY_VALUE = 25 // Okey left in hand = 25 points
export const MULTIPLIER_OKEY_FINISH = 2 // x2 for okey finish
export const MULTIPLIER_ELDEN_FINISH = 2 // x2 for finishing without discarding
export const MULTIPLIER_SEVEN_PAIRS = 2 // x2 for 7 pairs finish

// Turn timer (in seconds)
export const TURN_TIME_LIMIT = 60

// Room settings
export const MAX_PLAYERS = 4
export const MIN_PLAYERS = 4

// Seat positions (for paired mode: 0&2 are partners, 1&3 are partners)
export const SEAT_POSITIONS = [0, 1, 2, 3] as const
export type SeatPosition = typeof SEAT_POSITIONS[number]

// Partner mapping for paired mode
export const PARTNER_MAP: Record<SeatPosition, SeatPosition> = {
  0: 2,
  1: 3,
  2: 0,
  3: 1
}

// Color codes for UI
export const TILE_COLOR_CODES: Record<TileColor, string> = {
  red: '#dc2626',
  blue: '#2563eb',
  black: '#1f2937',
  yellow: '#f59e0b'
}

// Theme colors (dark blue table theme)
export const THEME = {
  background: '#0a1929',
  surface: '#132f4c',
  surfaceLight: '#1a3a5c',
  accent: '#d4af37',
  accentHover: '#c9a227',
  text: '#f5f5f5',
  textMuted: '#8899aa',
  success: '#22c55e',
  error: '#ef4444',
  warning: '#f59e0b',
  tableGreen: '#0d2137',
  rackColor: '#d4870a',
  rackColorLight: '#e8a020'
}

