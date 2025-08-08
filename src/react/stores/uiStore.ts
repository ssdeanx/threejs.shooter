import { create } from 'zustand';

interface UIState {
  isOptionsOpen: boolean;
  audio: {
    master: number;
    sfx: number;
  };
  controls: {
    sensitivity: number;
    invertY: boolean;
  };
  graphics: {
    quality: 'low' | 'medium' | 'high';
  };
  toggleOptions: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isOptionsOpen: false,
  audio: {
    master: 1,
    sfx: 1,
  },
  controls: {
    sensitivity: 1,
    invertY: false,
  },
  graphics: {
    quality: 'medium',
  },
  toggleOptions: () => set((state) => ({ isOptionsOpen: !state.isOptionsOpen })),
}));