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
  inGame?: boolean
  onShowProfile?: () => void
  onShowHistory?: () => void
}

export function Navbar({ user, showBackButton, onBack, inGame, onShowProfile, onShowHistory }: NavbarProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    router.push('/101/auth/login')
  }

  const handleProfileClick = (e: React.MouseEvent) => {
    if (inGame && onShowProfile) {
      e.preventDefault()
      setMenuOpen(false)
      onShowProfile()
    }
  }

  const handleHistoryClick = (e: React.MouseEvent) => {
    if (inGame && onShowHistory) {
      e.preventDefault()
      setMenuOpen(false)
      onShowHistory()
    }
  }

  const handleLogoClick = (e: React.MouseEvent) => {
    if (inGame) {
      e.preventDefault()
    }
  }

  return (
    <nav className="bg-[#132f4c] border-b border-[#1a3a5c] px-3 py-2 relative z-30">
      <div className="flex items-center justify-between">
        {/* Left: back + logo */}
        <div className="flex items-center gap-2">
          {showBackButton && (
            <button onClick={onBack} className="text-[#8899aa] hover:text-[#d4af37] transition-colors text-sm">
              ←
            </button>
          )}
          <Link href="/101" onClick={handleLogoClick} className="flex items-center gap-1.5">
            <span className="text-lg">🎴</span>
            <span className="text-base font-bold text-[#d4af37]">Okey 101</span>
          </Link>
        </div>

        {/* Right */}
        {user ? (
          <>
            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/101/history"
                onClick={handleHistoryClick}
                className="text-[#8899aa] hover:text-white transition-colors text-sm"
              >
                Geçmiş
              </Link>
              <Link
                href={`/101/profile/${user.username}`}
                onClick={handleProfileClick}
                className="flex items-center gap-1.5 hover:text-[#d4af37] transition-colors"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xs font-medium">
                    {user.username[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm">{user.username}</span>
              </Link>
              {!inGame && (
                <button onClick={handleLogout} className="text-[#8899aa] hover:text-[#ef4444] transition-colors text-xs">
                  Çıkış
                </button>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden flex flex-col gap-1 p-1"
              aria-label="Menü"
            >
              <span className={`block w-5 h-0.5 bg-[#8899aa] transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#8899aa] transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-[#8899aa] transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/101/auth/login" className="text-[#8899aa] hover:text-white transition-colors text-sm">
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
        <div className="sm:hidden absolute top-full left-0 right-0 bg-[#132f4c] border-b border-[#1a3a5c] shadow-lg z-40">
          <Link
            href={`/101/profile/${user.username}`}
            onClick={(e) => { handleProfileClick(e); if (!inGame) setMenuOpen(false); }}
            className="flex items-center gap-2 px-4 py-3 hover:bg-[#1a3a5c] transition-colors border-b border-[#1a3a5c]/50"
          >
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#1a3a5c] flex items-center justify-center text-xs font-medium">
                {user.username[0].toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium">{user.username}</span>
          </Link>
          <Link
            href="/101/history"
            onClick={(e) => { handleHistoryClick(e); if (!inGame) setMenuOpen(false); }}
            className="block px-4 py-3 text-sm text-[#8899aa] hover:bg-[#1a3a5c] hover:text-white transition-colors border-b border-[#1a3a5c]/50"
          >
            Maç Geçmişi
          </Link>
          {!inGame && (
            <Link
              href="/101"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm text-[#8899aa] hover:bg-[#1a3a5c] hover:text-white transition-colors border-b border-[#1a3a5c]/50"
            >
              Lobi
            </Link>
          )}
          {!inGame && (
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-sm text-[#ef4444] hover:bg-[#1a3a5c] transition-colors"
            >
              Çıkış Yap
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
