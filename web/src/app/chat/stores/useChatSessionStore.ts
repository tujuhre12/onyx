import { create } from "zustand";
import {
  ChatState,
  RegenerationState,
  Message,
  ChatSessionSharedStatus,
  BackendChatSession,
} from "../interfaces";
import {
  getLatestMessageChain,
  MessageTreeState,
} from "../services/messageTree";
import { useMemo } from "react";

interface ChatSessionData {
  sessionId: string;
  messageTree: MessageTreeState;
  chatState: ChatState;
  regenerationState: RegenerationState | null;
  canContinue: boolean;
  submittedMessage: string;
  maxTokens: number;
  chatSessionSharedStatus: ChatSessionSharedStatus;
  selectedMessageForDocDisplay: number | null;
  abortController: AbortController;
  hasPerformedInitialScroll: boolean;

  // Session metadata
  lastAccessed: Date;
  isLoaded: boolean;
  description?: string;
  personaId?: number;
}

interface GlobalChatState {
  isFetchingChatMessages: boolean;
  agenticGenerating: boolean;
  uncaughtError: string | null;
  loadingError: string | null;
  isReady: boolean;
}

interface ChatSessionStore extends GlobalChatState {
  // Session management
  currentSessionId: string | null;
  sessions: Map<string, ChatSessionData>;

  // Actions - Session Management
  setCurrentSession: (sessionId: string | null) => void;
  createSession: (
    sessionId: string,
    initialData?: Partial<ChatSessionData>
  ) => void;
  updateSessionData: (
    sessionId: string,
    updates: Partial<ChatSessionData>
  ) => void;
  updateSessionMessageTree: (
    sessionId: string,
    messageTree: MessageTreeState
  ) => void;
  updateSessionAndMessageTree: (
    sessionId: string,
    messageTree: MessageTreeState
  ) => void;

  // Actions - Message Management
  updateChatState: (sessionId: string, chatState: ChatState) => void;
  updateRegenerationState: (
    sessionId: string,
    state: RegenerationState | null
  ) => void;
  updateCanContinue: (sessionId: string, canContinue: boolean) => void;
  updateSubmittedMessage: (sessionId: string, message: string) => void;
  updateSelectedMessageForDocDisplay: (
    sessionId: string,
    selectedMessageForDocDisplay: number | null
  ) => void;
  updateHasPerformedInitialScroll: (
    sessionId: string,
    hasPerformedInitialScroll: boolean
  ) => void;

  // Actions - Global State
  setIsFetchingChatMessages: (fetching: boolean) => void;
  setAgenticGenerating: (generating: boolean) => void;
  setUncaughtError: (error: string | null) => void;
  setLoadingError: (error: string | null) => void;
  setIsReady: (ready: boolean) => void;

  // Actions - Abort Controllers
  setAbortController: (sessionId: string, controller: AbortController) => void;
  abortSession: (sessionId: string) => void;
  abortAllSessions: () => void;

  // Utilities
  initializeSession: (
    sessionId: string,
    backendSession?: BackendChatSession
  ) => void;
  cleanupOldSessions: (maxSessions?: number) => void;
}

const createInitialSessionData = (
  sessionId: string,
  initialData?: Partial<ChatSessionData>
): ChatSessionData => ({
  sessionId,
  messageTree: new Map<number, Message>(),
  chatState: "input" as ChatState,
  regenerationState: null,
  canContinue: false,
  submittedMessage: "",
  maxTokens: 128_000,
  chatSessionSharedStatus: ChatSessionSharedStatus.Private,
  selectedMessageForDocDisplay: null,
  abortController: new AbortController(),
  hasPerformedInitialScroll: true,
  lastAccessed: new Date(),
  isLoaded: false,
  ...initialData,
});

export const useChatSessionStore = create<ChatSessionStore>()((set, get) => ({
  // Initial state
  currentSessionId: null,
  sessions: new Map<string, ChatSessionData>(),

  // Global state
  isFetchingChatMessages: false,
  agenticGenerating: false,
  uncaughtError: null,
  loadingError: null,
  isReady: false,

  // Session Management Actions
  setCurrentSession: (sessionId: string | null) => {
    set((state) => {
      if (sessionId && !state.sessions.has(sessionId)) {
        // Create new session if it doesn't exist
        const newSession = createInitialSessionData(sessionId);
        const newSessions = new Map(state.sessions);
        newSessions.set(sessionId, newSession);

        return {
          currentSessionId: sessionId,
          sessions: newSessions,
        };
      }

      // Update last accessed for the new current session
      if (sessionId && state.sessions.has(sessionId)) {
        const session = state.sessions.get(sessionId)!;
        const updatedSession = { ...session, lastAccessed: new Date() };
        const newSessions = new Map(state.sessions);
        newSessions.set(sessionId, updatedSession);

        return {
          currentSessionId: sessionId,
          sessions: newSessions,
        };
      }

      return { currentSessionId: sessionId };
    });
  },

  createSession: (
    sessionId: string,
    initialData?: Partial<ChatSessionData>
  ) => {
    set((state) => {
      const newSession = createInitialSessionData(sessionId, initialData);
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, newSession);

      return { sessions: newSessions };
    });
  },

  updateSessionData: (sessionId: string, updates: Partial<ChatSessionData>) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      const updatedSession = {
        ...(session || createInitialSessionData(sessionId)),
        ...updates,
        lastAccessed: new Date(),
      };
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, updatedSession);

      return { sessions: newSessions };
    });
  },

  updateSessionMessageTree: (
    sessionId: string,
    messageTree: MessageTreeState
  ) => {
    console.log("updateSessionMessageTree", sessionId, messageTree);
    get().updateSessionData(sessionId, { messageTree });
  },

  updateSessionAndMessageTree: (
    sessionId: string,
    messageTree: MessageTreeState
  ) => {
    set((state) => {
      // Ensure session exists
      const existingSession = state.sessions.get(sessionId);
      const session = existingSession || createInitialSessionData(sessionId);

      // Update session with new message tree
      const updatedSession = {
        ...session,
        messageTree,
        lastAccessed: new Date(),
      };

      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, updatedSession);

      // Return both updates in a single state change
      return {
        currentSessionId: sessionId,
        sessions: newSessions,
      };
    });
  },

  // Message Management Actions
  updateChatState: (sessionId: string, chatState: ChatState) => {
    get().updateSessionData(sessionId, { chatState });
  },

  updateRegenerationState: (
    sessionId: string,
    regenerationState: RegenerationState | null
  ) => {
    get().updateSessionData(sessionId, { regenerationState });
  },

  updateCanContinue: (sessionId: string, canContinue: boolean) => {
    get().updateSessionData(sessionId, { canContinue });
  },

  updateSubmittedMessage: (sessionId: string, submittedMessage: string) => {
    get().updateSessionData(sessionId, { submittedMessage });
  },

  updateSelectedMessageForDocDisplay: (
    sessionId: string,
    selectedMessageForDocDisplay: number | null
  ) => {
    get().updateSessionData(sessionId, { selectedMessageForDocDisplay });
  },

  updateHasPerformedInitialScroll: (
    sessionId: string,
    hasPerformedInitialScroll: boolean
  ) => {
    get().updateSessionData(sessionId, { hasPerformedInitialScroll });
  },

  // Global State Actions
  setIsFetchingChatMessages: (isFetchingChatMessages: boolean) => {
    set({ isFetchingChatMessages });
  },

  setAgenticGenerating: (agenticGenerating: boolean) => {
    set({ agenticGenerating });
  },

  setUncaughtError: (uncaughtError: string | null) => {
    set({ uncaughtError });
  },

  setLoadingError: (loadingError: string | null) => {
    set({ loadingError });
  },

  setIsReady: (isReady: boolean) => {
    set({ isReady });
  },

  // Abort Controller Actions
  setAbortController: (sessionId: string, controller: AbortController) => {
    get().updateSessionData(sessionId, { abortController: controller });
  },

  abortSession: (sessionId: string) => {
    const session = get().sessions.get(sessionId);
    if (session?.abortController) {
      session.abortController.abort();
      get().updateSessionData(sessionId, {
        abortController: new AbortController(),
      });
    }
  },

  abortAllSessions: () => {
    const { sessions } = get();
    sessions.forEach((session, sessionId) => {
      if (session.abortController) {
        session.abortController.abort();
        get().updateSessionData(sessionId, {
          abortController: new AbortController(),
        });
      }
    });
  },

  // Utilities
  initializeSession: (
    sessionId: string,
    backendSession?: BackendChatSession
  ) => {
    const initialData: Partial<ChatSessionData> = {
      isLoaded: true,
      description: backendSession?.description,
      personaId: backendSession?.persona_id,
    };

    const existingSession = get().sessions.get(sessionId);
    if (existingSession) {
      get().updateSessionData(sessionId, initialData);
    } else {
      get().createSession(sessionId, initialData);
    }
  },

  cleanupOldSessions: (maxSessions: number = 10) => {
    set((state) => {
      const sortedSessions = Array.from(state.sessions.entries()).sort(
        ([, a], [, b]) => b.lastAccessed.getTime() - a.lastAccessed.getTime()
      );

      if (sortedSessions.length <= maxSessions) {
        return state;
      }

      const sessionsToKeep = sortedSessions.slice(0, maxSessions);
      const sessionsToRemove = sortedSessions.slice(maxSessions);

      // Abort controllers for sessions being removed
      sessionsToRemove.forEach(([, session]) => {
        if (session.abortController) {
          session.abortController.abort();
        }
      });

      const newSessions = new Map(sessionsToKeep);

      return {
        sessions: newSessions,
      };
    });
  },
}));

// Custom hooks for accessing store data
export const useCurrentSession = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    return currentSessionId ? sessions.get(currentSessionId) || null : null;
  });

export const useSession = (sessionId: string) =>
  useChatSessionStore((state) => state.sessions.get(sessionId) || null);

export const useCurrentMessageTree = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.messageTree;
  });

export const useCurrentMessageHistory = () => {
  const messageTree = useCurrentMessageTree();
  return useMemo(() => {
    if (!messageTree) {
      return [];
    }
    return getLatestMessageChain(messageTree);
  }, [messageTree]);
};

export const useCurrentChatState = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.chatState || "input";
  });

export const useCurrentRegenerationState = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.regenerationState || null;
  });

export const useCanContinue = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.canContinue || false;
  });

export const useSubmittedMessage = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.submittedMessage || "";
  });

export const useRegenerationState = (sessionId: string) =>
  useChatSessionStore((state) => {
    const session = state.sessions.get(sessionId);
    return session?.regenerationState || null;
  });

export const useAbortController = (sessionId: string) =>
  useChatSessionStore((state) => {
    const session = state.sessions.get(sessionId);
    return session?.abortController || null;
  });

export const useAbortControllers = () => {
  const sessions = useChatSessionStore((state) => state.sessions);
  return useMemo(() => {
    const controllers = new Map<string, AbortController>();
    sessions.forEach((session: ChatSessionData) => {
      if (session.abortController) {
        controllers.set(session.sessionId, session.abortController);
      }
    });
    return controllers;
  }, [sessions]);
};

// Global state hooks
export const useAgenticGenerating = () =>
  useChatSessionStore((state) => state.agenticGenerating);

export const useIsFetching = () =>
  useChatSessionStore((state) => state.isFetchingChatMessages);

export const useUncaughtError = () =>
  useChatSessionStore((state) => state.uncaughtError);

export const useLoadingError = () =>
  useChatSessionStore((state) => state.loadingError);

export const useIsReady = () => useChatSessionStore((state) => state.isReady);

export const useMaxTokens = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.maxTokens || 128_000;
  });

export const useHasPerformedInitialScroll = () =>
  useChatSessionStore((state) => {
    const { currentSessionId, sessions } = state;
    const currentSession = currentSessionId
      ? sessions.get(currentSessionId)
      : null;
    return currentSession?.hasPerformedInitialScroll || true;
  });
