import type { Tile } from './tiles'

// Bot player prefix for identification
export const BOT_USER_PREFIX = 'bot_'

// Bot usernames
export const BOT_NAMES = ['Bot 1', 'Bot 2', 'Bot 3', 'Bot 4']

/**
 * Check if a user ID belongs to a bot
 */
export function isBot(userId: string): boolean {
    return userId.startsWith(BOT_USER_PREFIX)
}

/**
 * Generate a unique bot ID
 */
export function generateBotId(): string {
    return `${BOT_USER_PREFIX}${crypto.randomUUID()}`
}

/**
 * Get bot username based on bot number (1-4)
 */
export function getBotName(botNumber: number): string {
    return BOT_NAMES[Math.min(botNumber - 1, BOT_NAMES.length - 1)] || `Bot ${botNumber}`
}

/**
 * Simple bot AI: select a random tile to discard
 * For now, just picks a random tile from hand
 */
export function selectTileToDiscard(hand: Tile[]): Tile | null {
    if (hand.length === 0) return null
    const randomIndex = Math.floor(Math.random() * hand.length)
    return hand[randomIndex]
}

/**
 * Bot action result
 */
export interface BotAction {
    type: 'draw_and_discard'
    discardTileId: string
}

/**
 * Get the action a bot should take
 * Simple AI: draw from deck, discard random tile
 */
export function getBotAction(hand: Tile[]): BotAction | null {
    const tileToDiscard = selectTileToDiscard(hand)
    if (!tileToDiscard) return null

    return {
        type: 'draw_and_discard',
        discardTileId: tileToDiscard.id
    }
}
