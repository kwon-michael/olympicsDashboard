import { create } from "zustand";
import type { User, Team, TeamMember } from "@/lib/types";

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // Team
  currentTeam: (Team & { members: TeamMember[] }) | null;
  setCurrentTeam: (team: (Team & { members: TeamMember[] }) | null) => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // User
  user: null,
  setUser: (user) => set({ user }),

  // Team
  currentTeam: null,
  setCurrentTeam: (currentTeam) => set({ currentTeam }),

  // UI
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
