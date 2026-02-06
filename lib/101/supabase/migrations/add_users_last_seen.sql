-- Add last_seen column to users table for online tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NULL;

-- Create an index for faster online user queries
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen) WHERE last_seen IS NOT NULL;
