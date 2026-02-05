'use client'

import type { User } from '@/lib/101/supabase/types'

interface StatsProps {
  user: User
}

export function Stats({ user }: StatsProps) {
  const totalGames = user.wins + user.losses
  const winRate = totalGames > 0 ? Math.round((user.wins / totalGames) * 100) : 0

  return (
    <div className="okey-card">
      <h2 className="font-bold mb-4">İstatistikler</h2>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Toplam Oyun"
          value={totalGames.toString()}
          color="text-[#f5f5f5]"
        />
        <StatCard
          label="Galibiyet"
          value={user.wins.toString()}
          color="text-[#22c55e]"
        />
        <StatCard
          label="Mağlubiyet"
          value={user.losses.toString()}
          color="text-[#ef4444]"
        />
        <StatCard
          label="Kazanma Oranı"
          value={`${winRate}%`}
          color="text-[#d4af37]"
        />
      </div>

      {/* Win rate bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#22c55e]">Galibiyet</span>
          <span className="text-[#ef4444]">Mağlubiyet</span>
        </div>
        <div className="h-4 bg-[#0a1929] rounded-full overflow-hidden flex">
          <div
            className="h-full bg-[#22c55e] transition-all duration-500"
            style={{ width: `${winRate}%` }}
          />
          <div
            className="h-full bg-[#ef4444] transition-all duration-500"
            style={{ width: `${100 - winRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0a1929] rounded-lg p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[#8899aa] mt-1">{label}</p>
    </div>
  )
}

