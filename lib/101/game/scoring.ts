import { Tile, isOkeyTile, calculateHandValue } from './tiles'
import {
  TileColor,
  TileNumber,
  OKEY_PENALTY_VALUE,
  MULTIPLIER_OKEY_FINISH,
  MULTIPLIER_ELDEN_FINISH,
  MULTIPLIER_SEVEN_PAIRS,
  MULTIPLIER_PAIRS_OPENING,
  NOT_OPENED_PENALTY,
  PARTNER_MAP,
  SeatPosition
} from './constants'

export type FinishType = 'normal' | 'okey' | 'elden' | 'yedi_cift'
export type GameMode = 'paired' | 'solo'

export interface PlayerScore {
  playerId: string
  seatPosition: SeatPosition
  handValue: number
  multiplier: number
  finalScore: number
  isWinner: boolean
  isPartner: boolean
}

export interface GameResult {
  winnerId: string
  winnerSeat: SeatPosition
  finishType: FinishType
  gameMode: GameMode
  scores: PlayerScore[]
  totalDuration: number
}

// Check if finish was with okey (last tile played was okey or finish included okey)
export function wasOkeyFinish(
  lastPlayedTile: Tile | null,
  okeyDef: { color: TileColor; number: TileNumber }
): boolean {
  if (!lastPlayedTile) return false
  return isOkeyTile(lastPlayedTile, okeyDef)
}

// Get the multiplier based on finish type
export function getFinishMultiplier(finishType: FinishType): number {
  switch (finishType) {
    case 'okey':
      return MULTIPLIER_OKEY_FINISH // x2
    case 'elden':
      return MULTIPLIER_ELDEN_FINISH // x2
    case 'yedi_cift':
      return MULTIPLIER_SEVEN_PAIRS // x2
    case 'normal':
    default:
      return 1
  }
}

// Check if two seats are partners (in paired mode)
export function arePartners(seat1: SeatPosition, seat2: SeatPosition): boolean {
  return PARTNER_MAP[seat1] === seat2
}

// Calculate final scores for all players
export function calculateFinalScores(
  players: Array<{
    id: string
    seatPosition: SeatPosition
    hand: Tile[]
    hasOpened?: boolean
    openedWithPairs?: boolean
  }>,
  winnerId: string,
  winnerSeat: SeatPosition,
  finishType: FinishType,
  gameMode: GameMode,
  okeyDef: { color: TileColor; number: TileNumber }
): PlayerScore[] {
  const baseMultiplier = getFinishMultiplier(finishType)

  return players.map(player => {
    const isWinner = player.id === winnerId
    const isPartnerOfWinner = gameMode === 'paired' && arePartners(player.seatPosition, winnerSeat)

    // Winner gets 0 points
    if (isWinner) {
      return {
        playerId: player.id,
        seatPosition: player.seatPosition,
        handValue: 0,
        multiplier: 1,
        finalScore: 0,
        isWinner: true,
        isPartner: false
      }
    }

    // Check for açmama cezası (202 penalty) - player didn't open at all
    if (player.hasOpened === false) {
      return {
        playerId: player.id,
        seatPosition: player.seatPosition,
        handValue: NOT_OPENED_PENALTY,
        multiplier: 1,
        finalScore: NOT_OPENED_PENALTY,
        isWinner: false,
        isPartner: isPartnerOfWinner
      }
    }

    // Calculate hand value
    const handValue = calculateHandValue(player.hand, okeyDef)

    // Determine multiplier
    // In paired mode, partner's score is NOT multiplied
    // Only opponents get the multiplier
    let multiplier = 1

    // Check for çiftten açma dezavantajı (x2 if opened with pairs)
    if (player.openedWithPairs) {
      multiplier = MULTIPLIER_PAIRS_OPENING
    } else if (finishType !== 'normal') {
      if (gameMode === 'paired') {
        // In paired mode, only opponents get x2
        if (!isPartnerOfWinner) {
          multiplier = baseMultiplier
        }
        // Partner keeps x1 multiplier
      } else {
        // In solo mode, everyone except winner gets x2
        multiplier = baseMultiplier
      }
    }

    const finalScore = handValue * multiplier

    return {
      playerId: player.id,
      seatPosition: player.seatPosition,
      handValue,
      multiplier,
      finalScore,
      isWinner: false,
      isPartner: isPartnerOfWinner
    }
  })
}

// Calculate team scores for paired mode
export function calculateTeamScores(
  scores: PlayerScore[]
): { team1: number; team2: number } {
  // Team 1: seats 0 and 2
  // Team 2: seats 1 and 3
  const team1 = scores
    .filter(s => s.seatPosition === 0 || s.seatPosition === 2)
    .reduce((sum, s) => sum + s.finalScore, 0)

  const team2 = scores
    .filter(s => s.seatPosition === 1 || s.seatPosition === 3)
    .reduce((sum, s) => sum + s.finalScore, 0)

  return { team1, team2 }
}

// Determine winner(s) for paired mode
export function determineWinningTeam(
  scores: PlayerScore[]
): { winningTeam: 1 | 2; team1Score: number; team2Score: number } {
  const { team1, team2 } = calculateTeamScores(scores)

  // Lower score wins (since scores represent penalty points)
  const winningTeam = team1 <= team2 ? 1 : 2

  return { winningTeam, team1Score: team1, team2Score: team2 }
}

// Format score summary for display
export function formatScoreSummary(result: GameResult): string {
  const winnerScore = result.scores.find(s => s.isWinner)
  if (!winnerScore) return ''

  let summary = `${winnerScore.playerId} kazandı!`

  if (result.finishType !== 'normal') {
    const finishTypeText = {
      'okey': 'Okey ile bitiş (x2)',
      'elden': 'Elden bitiş (x2)',
      'yedi_cift': '7 çift ile bitiş (x2)'
    }[result.finishType]
    summary += ` - ${finishTypeText}`
  }

  if (result.gameMode === 'paired') {
    summary += ' (Eşli oyun)'
  }

  return summary
}

// Check if a score triggers match end (for multi-round games)
export function checkMatchEnd(
  cumulativeScores: Record<string, number>,
  targetScore: number
): { isMatchOver: boolean; loserId?: string } {
  for (const [playerId, score] of Object.entries(cumulativeScores)) {
    if (score >= targetScore) {
      return { isMatchOver: true, loserId: playerId }
    }
  }
  return { isMatchOver: false }
}

