'use client'

import { useState } from 'react'

interface CreateRoomModalProps {
  onClose: () => void
  onCreate: (name: string, isPaired: boolean, isFolding: boolean) => Promise<{ success: boolean; error?: string }>
}

export function CreateRoomModal({ onClose, onCreate }: CreateRoomModalProps) {
  const [name, setName] = useState('')
  const [isPaired, setIsPaired] = useState(false)
  const [isFolding, setIsFolding] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Oda adı gerekli')
      return
    }

    setIsLoading(true)
    const result = await onCreate(name.trim(), isPaired, isFolding)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Oda oluşturulamadı')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="okey-card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Yeni Oda Oluştur</h2>
          <button
            onClick={onClose}
            className="text-[#a0a0a0] hover:text-white transition-colors text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-[#ef4444]/20 border border-[#ef4444] rounded-lg p-3 text-[#ef4444] text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Oda Adı</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="okey-input"
              placeholder="Örn: Dostlar Masası"
              disabled={isLoading}
              maxLength={50}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium">Oyun Modu</label>
            
            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#1a2f23] cursor-pointer hover:bg-[#1a2f23]/80 transition-colors">
              <input
                type="checkbox"
                checked={isPaired}
                onChange={(e) => setIsPaired(e.target.checked)}
                className="w-5 h-5 rounded border-[#3d5a4a] text-[#d4af37] focus:ring-[#d4af37]"
              />
              <div>
                <span className="font-medium">Eşli Oyun</span>
                <p className="text-sm text-[#a0a0a0]">2v2 takım oyunu</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-[#1a2f23] cursor-pointer hover:bg-[#1a2f23]/80 transition-colors">
              <input
                type="checkbox"
                checked={isFolding}
                onChange={(e) => setIsFolding(e.target.checked)}
                className="w-5 h-5 rounded border-[#3d5a4a] text-[#d4af37] focus:ring-[#d4af37]"
              />
              <div>
                <span className="font-medium">Katlamalı</span>
                <p className="text-sm text-[#a0a0a0]">Puanlar katlanabilir</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="okey-btn okey-btn-secondary flex-1"
              disabled={isLoading}
            >
              İptal
            </button>
            <button
              type="submit"
              className="okey-btn okey-btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

