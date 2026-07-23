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

  // Admin "view as volunteer" preview. When true, an admin sees the reduced
  // volunteer experience. Client-only and intentionally not persisted, so a
  // hard refresh returns to the full admin view.
  viewAsVolunteer: boolean;
  setViewAsVolunteer: (on: boolean) => void;
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

  // Admin "view as volunteer" preview
  viewAsVolunteer: false,
  setViewAsVolunteer: (on) => set({ viewAsVolunteer: on }),
}));
