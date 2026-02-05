'use client'

interface GameControlsProps {
  isMyTurn: boolean
  hasDrawn: boolean
  selectedTileCount: number
  onDrawDeck: () => void
  onDrawDiscard: () => void
  onDiscard: () => void
  onOpen: () => void
  isLoading: boolean
  canDrawDiscard: boolean
}

export function GameControls({
  isMyTurn,
  hasDrawn,
  selectedTileCount,
  onDrawDeck,
  onDrawDiscard,
  onDiscard,
  onOpen,
  isLoading,
  canDrawDiscard
}: GameControlsProps) {
  if (!isMyTurn) {
    return (
      <div className="text-center text-[#a0a0a0] py-4">
        Sıra rakipte...
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      {!hasDrawn ? (
        <>
          <button
            onClick={onDrawDeck}
            disabled={isLoading}
            className="okey-btn okey-btn-primary"
          >
            {isLoading ? 'Çekiliyor...' : 'Desteden Çek'}
          </button>
          <button
            onClick={onDrawDiscard}
            disabled={isLoading || !canDrawDiscard}
            className="okey-btn okey-btn-secondary disabled:opacity-50"
          >
            Çöpten Çek
          </button>
        </>
      ) : (
        <>
          {selectedTileCount > 0 && (
            <button
              onClick={onDiscard}
              disabled={isLoading || selectedTileCount !== 1}
              className="okey-btn okey-btn-danger"
            >
              {isLoading ? 'Atılıyor...' : 'Seçili Taşı At'}
            </button>
          )}
          {selectedTileCount >= 3 && (
            <button
              onClick={onOpen}
              disabled={isLoading}
              className="okey-btn okey-btn-primary"
            >
              Per Aç
            </button>
          )}
        </>
      )}
    </div>
  )
}

