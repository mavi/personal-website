export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Tile types for game
export interface TileData {
  id: string
  color: 'red' | 'blue' | 'black' | 'yellow'
  number: number
  isJoker: boolean
}

// Player hand in game
export interface PlayerHand {
  odlayerId: string
  tiles: TileData[]
}

// Opened sets on the table
export interface OpenedSet {
  playerId: string
  tiles: TileData[]
  type: 'run' | 'set'
}

// Game state stored in database
export interface GameStateData {
  hands: Record<string, TileData[]>
  deck: TileData[]
  discardPile: TileData[]
  openedSets: OpenedSet[]
  indicatorTile: TileData | null
  okeyTile: { color: string; number: number } | null
  currentTurn: number
  turnStartTime: string
  hasDrawn: boolean
  gamePhase: 'waiting' | 'playing' | 'finished'
  winner: string | null
  finishType: 'normal' | 'okey' | 'elden' | 'yedi_cift' | null
}

// Final scores for match history
export interface FinalScores {
  [playerId: string]: {
    score: number
    handValue: number
    multiplier: number
  }
}

// Database schema types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          password_hash: string
          avatar_url: string | null
          bio: string | null
          wins: number
          losses: number
          created_at: string
        }
        Insert: {
          id?: string
          username: string
          password_hash: string
          avatar_url?: string | null
          bio?: string | null
          wins?: number
          losses?: number
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          password_hash?: string
          avatar_url?: string | null
          bio?: string | null
          wins?: number
          losses?: number
          created_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          host_id: string
          status: 'waiting' | 'playing' | 'finished'
          is_paired: boolean
          is_folding: boolean
          player_count: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          host_id: string
          status?: 'waiting' | 'playing' | 'finished'
          is_paired?: boolean
          is_folding?: boolean
          player_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          host_id?: string
          status?: 'waiting' | 'playing' | 'finished'
          is_paired?: boolean
          is_folding?: boolean
          player_count?: number
          created_at?: string
        }
      }
      room_players: {
        Row: {
          id: string
          room_id: string
          user_id: string
          seat_position: number
          is_ready: boolean
          joined_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          seat_position: number
          is_ready?: boolean
          joined_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          seat_position?: number
          is_ready?: boolean
          joined_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          room_id: string
          players: Json
          final_scores: Json
          winner_id: string | null
          game_mode: string
          finish_type: string | null
          played_at: string
          duration: number | null
        }
        Insert: {
          id?: string
          room_id: string
          players: Json
          final_scores: Json
          winner_id?: string | null
          game_mode: string
          finish_type?: string | null
          played_at?: string
          duration?: number | null
        }
        Update: {
          id?: string
          room_id?: string
          players?: Json
          final_scores?: Json
          winner_id?: string | null
          game_mode?: string
          finish_type?: string | null
          played_at?: string
          duration?: number | null
        }
      }
      game_states: {
        Row: {
          id: string
          room_id: string
          current_turn: number
          hands: Json
          deck: Json
          discard_pile: Json
          opened_sets: Json
          indicator_tile: Json | null
          okey_tile: Json | null
          game_phase: string
          has_drawn: boolean
          turn_start_time: string | null
          winner: string | null
          finish_type: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          current_turn?: number
          hands?: Json
          deck?: Json
          discard_pile?: Json
          opened_sets?: Json
          indicator_tile?: Json | null
          okey_tile?: Json | null
          game_phase?: string
          has_drawn?: boolean
          turn_start_time?: string | null
          winner?: string | null
          finish_type?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          current_turn?: number
          hands?: Json
          deck?: Json
          discard_pile?: Json
          opened_sets?: Json
          indicator_tile?: Json | null
          okey_tile?: Json | null
          game_phase?: string
          has_drawn?: boolean
          turn_start_time?: string | null
          winner?: string | null
          finish_type?: string | null
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string
          user_id: string
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          message?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type User = Database['public']['Tables']['users']['Row']
export type Room = Database['public']['Tables']['rooms']['Row']
export type RoomPlayer = Database['public']['Tables']['room_players']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type GameState = Database['public']['Tables']['game_states']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

// Game state as returned from the database API
export interface GameStateFromDB {
  id: string
  room_id: string
  current_turn: number
  hands: Json
  deck: Json
  discard_pile: Json
  opened_sets: Json
  indicator_tile: Json | null
  okey_tile: Json | null
  game_phase: string
  has_drawn: boolean
  turn_start_time: string | null
  winner: string | null
  finish_type: string | null
  updated_at: string
}

// Room player with joined user info
export interface RoomPlayerWithUser extends RoomPlayer {
  user?: { username: string; avatar_url: string | null }
}

// Room with players included
export interface RoomWithPlayers extends Room {
  players: RoomPlayerWithUser[]
  host?: { username: string; avatar_url: string | null }
}

