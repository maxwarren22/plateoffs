import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VoteSession } from '@/lib/supabase';

export type GameMode = 'solo' | 'multiplayer';

interface SessionState {
  mode: GameMode;
  session: VoteSession | null;
  isHost: boolean;
  participantCount: number;

  // Persisted so the "Return to session" card survives app restarts
  lastSessionCode: string | null;
  lastSessionDivisionName: string | null;
  lastSessionExpiresAt: string | null;

  setMode: (mode: GameMode) => void;
  setSession: (session: VoteSession, isHost: boolean) => void;
  setParticipantCount: (n: number) => void;
  updateSessionStatus: (status: VoteSession['status']) => void;
  clearSession: () => void;
  clearLastSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      mode: 'solo',
      session: null,
      isHost: false,
      participantCount: 1,
      lastSessionCode: null,
      lastSessionDivisionName: null,
      lastSessionExpiresAt: null,

      setMode: (mode) => set({ mode }),

      setSession: (session, isHost) => set({
        session,
        isHost,
        participantCount: 1,
        lastSessionCode: session.code,
        lastSessionDivisionName: session.division_name,
        lastSessionExpiresAt: session.expires_at,
      }),

      setParticipantCount: (participantCount) => set({ participantCount }),

      updateSessionStatus: (status) =>
        set((state) => ({
          session: state.session ? { ...state.session, status } : null,
        })),

      clearSession: () => set({ session: null, isHost: false, participantCount: 1, mode: 'solo' }),

      clearLastSession: () => set({ lastSessionCode: null, lastSessionDivisionName: null, lastSessionExpiresAt: null }),
    }),
    {
      name: 'plateoffs-session',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the resume-card fields — in-memory session state rebuilds from DB on re-open
      partialize: (state) => ({
        lastSessionCode: state.lastSessionCode,
        lastSessionDivisionName: state.lastSessionDivisionName,
        lastSessionExpiresAt: state.lastSessionExpiresAt,
      }),
    }
  )
);
