'use client'

import type { Match } from '@/lib/101/supabase/types'

interface MatchHistoryProps {
  matches: Match[]
  currentUserId: string
}

export function MatchHistory({ matches, currentUserId }: MatchHistoryProps) {
  if (matches.length === 0) {
    return (
      <div className="okey-card text-center py-8">
        <p className="text-[#a0a0a0]">Henüz maç geçmişi yok</p>
      </div>
    )
  }

  return (
    <div className="okey-card">
      <h2 className="font-bold mb-4">Maç Geçmişi</h2>
      
      <div className="space-y-3">
        {matches.map((match) => {
          const isWinner = match.winner_id === currentUserId
          const scores = match.final_scores as Record<string, number>
          const myScore = scores[currentUserId] || 0

          return (
            <div
              key={match.id}
              className={`p-4 rounded-lg border ${
                isWinner
                  ? 'border-[#22c55e]/30 bg-[#22c55e]/10'
                  : 'border-[#ef4444]/30 bg-[#ef4444]/10'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${
                  isWinner ? 'text-[#22c55e]' : 'text-[#ef4444]'
                }`}>
                  {isWinner ? '🏆 Galibiyet' : '❌ Mağlubiyet'}
                </span>
                <span className="text-sm text-[#a0a0a0]">
                  {new Date(match.played_at).toLocaleDateString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 text-sm">
                <span className="okey-badge bg-[#3d5a4a] text-[#a0a0a0]">
                  {match.game_mode === 'paired' ? 'Eşli' : 'Eşsiz'}
                </span>
                {match.finish_type && match.finish_type !== 'normal' && (
                  <span className="okey-badge bg-[#d4af37]/20 text-[#d4af37]">
                    {match.finish_type === 'okey' ? 'Okey (x2)' :
                     match.finish_type === 'elden' ? 'Elden (x2)' :
                     match.finish_type === 'yedi_cift' ? '7 Çift (x2)' : ''}
                  </span>
                )}
                <span className={`okey-badge ${
                  isWinner ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ef4444]/20 text-[#ef4444]'
                }`}>
                  {myScore} puan
                </span>
              </div>

              {match.duration && (
                <p className="text-xs text-[#a0a0a0] mt-2">
                  Süre: {Math.floor(match.duration / 60)} dk {match.duration % 60} sn
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

