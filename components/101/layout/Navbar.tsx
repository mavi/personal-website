'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/101/hooks/useAuth'
import type { User } from '@/lib/101/supabase/types'

interface NavbarProps {
  user: User | null
  showBackButton?: boolean
  onBack?: () => void
}

export function Navbar({ user, showBackButton, onBack }: NavbarProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    router.push('/101/auth/login')
  }

  return (
    <nav className="bg-[#2d4a3a] border-b border-[#3d5a4a] px-3 py-2 relative z-30">
      <div className="flex items-center justify-between">
        {/* Left: back + logo */}
        <div className="flex items-center gap-2">
          {showBackButton && (
            <button onClick={onBack} className="text-[#a0a0a0] hover:text-[#d4af37] transition-colors text-sm">
              ←
            </button>
          )}
          <Link href="/101" className="flex items-center gap-1.5">
            <span className="text-lg">🎴</span>
            <span className="text-base font-bold text-[#d4af37]">Okey 101</span>
          </Link>
        </div>

        {/* Right */}
        {user ? (
          <>
            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-3">
              <Link href="/101/history" className="text-[#a0a0a0] hover:text-white transition-colors text-sm">
                Geçmiş
              </Link>
              <Link href={`/101/profile/${user.username}`} className="flex items-center gap-1.5 hover:text-[#d4af37] transition-colors">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#3d5a4a] flex items-center justify-center text-xs font-medium">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm">{user.username}</span>
              </Link>
              <button onClick={handleLogout} className="text-[#a0a0a0] hover:text-[#ef4444] transition-colors text-xs">
                Çıkış
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden flex flex-col gap-1 p-1"
              aria-label="Menü"
            >
              <span className={`block w-5 h-0.5 bg-[#a0a0a0] transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#a0a0a0] transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#a0a0a0] transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/101/auth/login" className="text-[#a0a0a0] hover:text-white transition-colors text-sm">
              Giriş
            </Link>
            <Link href="/101/auth/register" className="okey-btn okey-btn-primary okey-btn-sm">
              Kayıt Ol
            </Link>
          </div>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && user && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-[#2d4a3a] border-b border-[#3d5a4a] shadow-lg z-40">
          <Link
            href={`/101/profile/${user.username}`}
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-4 py-3 hover:bg-[#3d5a4a] transition-colors border-b border-[#3d5a4a]/50"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#3d5a4a] flex items-center justify-center text-xs font-medium">
                {user.username[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">{user.username}</span>
          </Link>
          <Link
            href="/101/history"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-3 text-sm text-[#a0a0a0] hover:bg-[#3d5a4a] hover:text-white transition-colors border-b border-[#3d5a4a]/50"
          >
            Maç Geçmişi
          </Link>
          <Link
            href="/101"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-3 text-sm text-[#a0a0a0] hover:bg-[#3d5a4a] hover:text-white transition-colors border-b border-[#3d5a4a]/50"
          >
            Lobi
          </Link>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm text-[#ef4444] hover:bg-[#3d5a4a] transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      )}
    </nav>
  )
}
