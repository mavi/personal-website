import type { Tile } from './tiles'

// Bot player prefix for identification - used in username
export const BOT_USER_PREFIX = 'Bot_'

// Bot usernames
export const BOT_NAMES = ['Bot 1', 'Bot 2', 'Bot 3', 'Bot 4']

/**
 * Check if a user ID belongs to a bot
 * Bot IDs start with 00000000-0000-0000-0000- (special reserved range)
 */
export function isBot(userId: string): boolean {
    return userId.startsWith('00000000-0000-0000-0000-')
}

/**
 * Generate a unique bot ID using reserved UUID range
 * Format: 00000000-0000-0000-0000-XXXXXXXXXXXX where X is random hex
 */
export function generateBotId(): string {
    const randomPart = Array.from({ length: 12 }, () =>
        Math.floor(Math.random() * 16).toString(16)
    ).join('')
    return `00000000-0000-0000-0000-${randomPart}`
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
