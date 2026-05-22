import { create } from 'zustand';
import { fetchActiveDivisions, fetchAllRotationTimes } from '@/lib/supabase';
import { type Division } from '@/lib/tournament';

interface LobbyState {
  divisions: Division[];
  rotationTimes: Record<string, number>;
  loading: boolean;
  error: string | null;
  prefetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  divisions: [],
  rotationTimes: {},
  loading: false,
  error: null,

  prefetch: async () => {
    if (get().loading || get().divisions.length > 0) return;
    set({ loading: true, error: null });
    try {
      const [divisions, rotationTimes] = await Promise.all([
        fetchActiveDivisions(),
        fetchAllRotationTimes(),
      ]);
      set({ divisions, rotationTimes });
    } catch (e: any) {
      set({ error: e.message ?? 'Failed to load divisions' });
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    if (get().loading) return;
    // Silent background refresh — don't set loading so existing cards stay visible.
    try {
      const [divisions, rotationTimes] = await Promise.all([
        fetchActiveDivisions(),
        fetchAllRotationTimes(),
      ]);
      set({ divisions, rotationTimes });
    } catch {
      // Swallow silently — stale data is fine, don't flash an error on re-focus.
    }
  },
}));
