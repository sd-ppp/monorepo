import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

type SupabaseSessionState = {
  session: Session | null;
  setSession: (session: Session | null) => void;
};

export const supabaseSessionStore = create<SupabaseSessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}));
