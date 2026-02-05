import { create } from 'zustand'

// The Zustand store is used only for UI state (tile selection, drag).
// Game state itself is managed via API + realtime polling in the room page.

interface GameStore {
  // UI state
  selectedTiles: string[]
  isDragging: boolean
  hoveredSetId: string | null

  // Tile selection
  selectTile: (tileId: string) => void
  deselectTile: (tileId: string) => void
  clearSelection: () => void
  toggleTileSelection: (tileId: string) => void

  // Drag & drop
  setDragging: (dragging: boolean) => void
  setHoveredSet: (setId: string | null) => void

  // Reset
  reset: () => void
}

const initialState = {
  selectedTiles: [] as string[],
  isDragging: false,
  hoveredSetId: null as string | null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  selectTile: (tileId) => set((state) => ({
    selectedTiles: [...state.selectedTiles, tileId]
  })),

  deselectTile: (tileId) => set((state) => ({
    selectedTiles: state.selectedTiles.filter(id => id !== tileId)
  })),

  clearSelection: () => set({ selectedTiles: [] }),

  toggleTileSelection: (tileId) => set((state) => ({
    selectedTiles: state.selectedTiles.includes(tileId)
      ? state.selectedTiles.filter(id => id !== tileId)
      : [...state.selectedTiles, tileId]
  })),

  setDragging: (dragging) => set({ isDragging: dragging }),

  setHoveredSet: (setId) => set({ hoveredSetId: setId }),

  reset: () => set(initialState)
}))
