import { create } from 'zustand'

// The Zustand store is used for UI state (tile selection, drag, hand order, flipped tiles).
// Game state itself is managed via API + realtime polling in the room page.

interface GameStore {
  // UI state
  selectedTiles: string[]
  isDragging: boolean
  dragTileId: string | null
  dragSource: 'hand' | 'deck' | 'discard' | null
  hoveredSetId: string | null
  hoveredDropZone: 'discard' | 'set' | null

  // Hand ordering (client-side tile arrangement)
  handOrder: string[]
  
  // Flipped tiles (face-down for own convenience)
  flippedTiles: Set<string>

  // Tile selection
  selectTile: (tileId: string) => void
  deselectTile: (tileId: string) => void
  clearSelection: () => void
  toggleTileSelection: (tileId: string) => void

  // Hand ordering
  setHandOrder: (order: string[]) => void
  reorderTile: (fromIndex: number, toIndex: number) => void

  // Flip tiles
  flipTile: (tileId: string) => void
  clearFlipped: () => void

  // Drag & drop
  setDragging: (dragging: boolean) => void
  setDragTile: (tileId: string | null, source: 'hand' | 'deck' | 'discard' | null) => void
  setHoveredSet: (setId: string | null) => void
  setHoveredDropZone: (zone: 'discard' | 'set' | null) => void

  // Reset
  reset: () => void
}

const initialState = {
  selectedTiles: [] as string[],
  isDragging: false,
  dragTileId: null as string | null,
  dragSource: null as 'hand' | 'deck' | 'discard' | null,
  hoveredSetId: null as string | null,
  hoveredDropZone: null as 'discard' | 'set' | null,
  handOrder: [] as string[],
  flippedTiles: new Set<string>(),
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

  setHandOrder: (order) => set({ handOrder: order }),

  reorderTile: (fromIndex, toIndex) => set((state) => {
    const newOrder = [...state.handOrder]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, moved)
    return { handOrder: newOrder }
  }),

  flipTile: (tileId) => set((state) => {
    const newFlipped = new Set(state.flippedTiles)
    if (newFlipped.has(tileId)) {
      newFlipped.delete(tileId)
    } else {
      newFlipped.add(tileId)
    }
    return { flippedTiles: newFlipped }
  }),

  clearFlipped: () => set({ flippedTiles: new Set<string>() }),

  setDragging: (dragging) => set({ isDragging: dragging }),

  setDragTile: (tileId, source) => set({ 
    dragTileId: tileId, 
    dragSource: source,
    isDragging: tileId !== null 
  }),

  setHoveredSet: (setId) => set({ hoveredSetId: setId }),

  setHoveredDropZone: (zone) => set({ hoveredDropZone: zone }),

  reset: () => set({ ...initialState, flippedTiles: new Set<string>() })
}))
