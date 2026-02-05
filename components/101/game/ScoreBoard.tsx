'use client'

import type { PlayerScore } from '@/lib/101/game/scoring'

interface ScoreBoardProps {
  scores: PlayerScore[]
  playerNames: Record<string, string>
  currentUserId: string
}

export function ScoreBoard({ scores, playerNames, currentUserId }: ScoreBoardProps) {
  const sortedScores = [...scores].sort((a, b) => a.finalScore - b.finalScore)

  return (
    <div className="okey-card">
      <h3 className="font-bold mb-4 text-[#d4af37]">Skor Tablosu</h3>
      
      <div className="space-y-2">
        {sortedScores.map((score, index) => (
          <div
            key={score.playerId}
            className={`flex items-center justify-between p-2 rounded ${
              score.playerId === currentUserId
                ? 'bg-[#d4af37]/10 border border-[#d4af37]/30'
                : 'bg-[#1a2f23]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[#a0a0a0] text-sm w-6">#{index + 1}</span>
              <span className={score.isWinner ? 'text-[#22c55e] font-medium' : ''}>
                {playerNames[score.playerId] || 'Oyuncu'}
              </span>
              {score.isWinner && <span className="text-[#22c55e]">🏆</span>}
              {score.isPartner && <span className="text-xs text-[#a0a0a0]">(Eş)</span>}
            </div>
            <div className="text-right">
              <span className={`font-bold ${
                score.isWinner ? 'text-[#22c55e]' : 'text-[#ef4444]'
              }`}>
                {score.finalScore}
              </span>
              {score.multiplier > 1 && (
                <span className="text-xs text-[#f59e0b] ml-1">
                  (x{score.multiplier})
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

