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

// Selectors to minimize re-renders in components (prefer primitives)
export const useIsOptionsOpen = () => useUIStore((s) => s.isOptionsOpen);
export const useUIAudioMaster = () => useUIStore((s) => s.audio.master);
export const useUIAudioSfx = () => useUIStore((s) => s.audio.sfx);
export const useUIControlsSensitivity = () => useUIStore((s) => s.controls.sensitivity);
export const useUIControlsInvertY = () => useUIStore((s) => s.controls.invertY);
export const useUIGraphicsQuality = () => useUIStore((s) => s.graphics.quality);