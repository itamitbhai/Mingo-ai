import { create } from 'zustand';

interface ChatUIState {
  isMobileSidebarOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  /** Handoff for the message typed on the "no conversation yet" screen,
   *  carried across the redirect into the freshly created conversation's route. */
  pendingFirstMessages: Record<string, string>;
  setPendingFirstMessage: (conversationId: string, content: string) => void;
  consumePendingFirstMessage: (conversationId: string) => string | undefined;
}

export const useChatUIStore = create<ChatUIState>((set, get) => ({
  isMobileSidebarOpen: false,
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
  pendingFirstMessages: {},
  setPendingFirstMessage: (conversationId, content) =>
    set((state) => ({
      pendingFirstMessages: { ...state.pendingFirstMessages, [conversationId]: content },
    })),
  consumePendingFirstMessage: (conversationId) => {
    const content = get().pendingFirstMessages[conversationId];

    if (content !== undefined) {
      set((state) => {
        const next = { ...state.pendingFirstMessages };
        delete next[conversationId];
        return { pendingFirstMessages: next };
      });
    }

    return content;
  },
}));
