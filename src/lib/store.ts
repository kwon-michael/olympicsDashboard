import { create } from "zustand";
import type { User, Team, TeamMember, Announcement } from "@/lib/types";

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;

  // Team
  currentTeam: (Team & { members: TeamMember[] }) | null;
  setCurrentTeam: (team: (Team & { members: TeamMember[] }) | null) => void;

  // Announcements
  activeAnnouncements: Announcement[];
  announcementQueue: Announcement[];
  pushAnnouncement: (announcement: Announcement) => void;
  dismissAnnouncement: (id: string) => void;
  clearAnnouncements: () => void;

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

  // Announcements
  activeAnnouncements: [],
  announcementQueue: [],
  pushAnnouncement: (announcement) =>
    set((state) => ({
      announcementQueue: [...state.announcementQueue, announcement],
    })),
  dismissAnnouncement: (id) =>
    set((state) => ({
      activeAnnouncements: state.activeAnnouncements.filter((a) => a.id !== id),
    })),
  clearAnnouncements: () =>
    set({ activeAnnouncements: [], announcementQueue: [] }),

  // UI
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
