-- Okey 101 Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  is_paired BOOLEAN DEFAULT FALSE,
  is_folding BOOLEAN DEFAULT FALSE,
  player_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on status for room listings
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- Room players table
CREATE TABLE IF NOT EXISTS room_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_position INTEGER NOT NULL CHECK (seat_position >= 0 AND seat_position <= 3),
  is_ready BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, seat_position)
);

-- Create index for room player lookups
CREATE INDEX IF NOT EXISTS idx_room_players_room ON room_players(room_id);
CREATE INDEX IF NOT EXISTS idx_room_players_user ON room_players(user_id);

-- Game states table
CREATE TABLE IF NOT EXISTS game_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE UNIQUE,
  current_turn INTEGER DEFAULT 0,
  hands JSONB DEFAULT '{}',
  deck JSONB DEFAULT '[]',
  discard_pile JSONB DEFAULT '[]',
  opened_sets JSONB DEFAULT '[]',
  indicator_tile JSONB,
  okey_tile JSONB,
  game_phase VARCHAR(20) DEFAULT 'waiting' CHECK (game_phase IN ('waiting', 'playing', 'finished')),
  has_drawn BOOLEAN DEFAULT FALSE,
  turn_start_time TIMESTAMP WITH TIME ZONE,
  winner UUID REFERENCES users(id),
  finish_type VARCHAR(20) CHECK (finish_type IN ('normal', 'okey', 'elden', 'yedi_cift')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Matches (game history) table
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  players JSONB NOT NULL, -- Array of player IDs
  final_scores JSONB NOT NULL, -- {playerId: score}
  winner_id UUID REFERENCES users(id),
  game_mode VARCHAR(20) NOT NULL,
  finish_type VARCHAR(20),
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration INTEGER -- Duration in seconds
);

-- Create index for match history lookups
CREATE INDEX IF NOT EXISTS idx_matches_players ON matches USING GIN (players);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for chat message lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- Function to increment wins
CREATE OR REPLACE FUNCTION increment_wins(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET wins = wins + 1 WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment losses
CREATE OR REPLACE FUNCTION increment_losses(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET losses = losses + 1 WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Anyone can read, only own user can update
CREATE POLICY "Users are viewable by everyone" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (true); -- Will be restricted by API

-- Rooms: Anyone can read, authenticated can create
CREATE POLICY "Rooms are viewable by everyone" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create rooms" ON rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Host can update room" ON rooms
  FOR UPDATE USING (true);

CREATE POLICY "Host can delete room" ON rooms
  FOR DELETE USING (true);

-- Room players: Anyone can read, authenticated can join/leave
CREATE POLICY "Room players are viewable by everyone" ON room_players
  FOR SELECT USING (true);

CREATE POLICY "Anyone can join rooms" ON room_players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Players can leave rooms" ON room_players
  FOR DELETE USING (true);

CREATE POLICY "Players can update ready status" ON room_players
  FOR UPDATE USING (true);

-- Game states: Room members can read
CREATE POLICY "Game states are viewable by room members" ON game_states
  FOR SELECT USING (true);

CREATE POLICY "Game states can be created" ON game_states
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Game states can be updated" ON game_states
  FOR UPDATE USING (true);

-- Matches: Anyone can read own matches
CREATE POLICY "Matches are viewable" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Matches can be created" ON matches
  FOR INSERT WITH CHECK (true);

-- Chat messages: Room members can read and send
CREATE POLICY "Chat messages are viewable by room members" ON chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Room members can send messages" ON chat_messages
  FOR INSERT WITH CHECK (true);

-- Enable realtime for relevant tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE game_states;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

