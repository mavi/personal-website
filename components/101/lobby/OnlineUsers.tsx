'use client'

export function OnlineUsers() {
  // This would typically fetch online users from a presence channel
  // For now, we'll show a placeholder
  
  return (
    <div className="okey-card">
      <h2 className="font-bold mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
        Çevrimiçi
      </h2>
      
      <div className="text-sm text-[#a0a0a0]">
        <p>Çevrimiçi kullanıcılar burada görünecek</p>
      </div>
    </div>
  )
}

