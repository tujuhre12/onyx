"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  buildLatestMessageChain,
  processRawChatHistory,
  removeMessage,
  updateParentChildren,
  nameChatSession,
} from "@/app/chat/lib";
import {
  ChatSession,
  Message,
  BackendChatSession,
  ChatSessionSharedStatus,
} from "@/app/chat/interfaces";
import { ChatState, RegenerationState } from "@/app/chat/types";

/**
 * Hook: useChatSession
 *
 * Manages:
 *  - Which chat session is currently loaded (and its ID).
 *  - Fetching messages for that session from the backend, storing them in a Map.
 *  - Producing the "messageHistory" array from the stored message-map.
 *  - Tracking whether the session is currently being fetched.
 *  - Tracking the "shared status" of the session (private/public).
 *
 * Returns everything the consuming UI needs to:
 *  - Know which session is selected.
 *  - Access/modify the stored messages.
 *  - Check if fetching is in progress.
 *  - Possibly rename the session if needed, etc.
 */
export function useChatSession(params: {
  chatSessions: ChatSession[]; // from context or props
  existingChatSessionId: string | null; // e.g. from searchParams.get("chatId")
  defaultAssistantId?: number; // if you need a default assistant ID
  refreshChatSessions: () => void; // callback to refresh session list
}) {
  const {
    chatSessions,
    existingChatSessionId,
    defaultAssistantId,
    refreshChatSessions,
  } = params;

  const router = useRouter();
  const searchParams = useSearchParams();

  // Tracks which session we're "actively" viewing.
  const chatSessionIdRef = useRef<string | null>(existingChatSessionId);

  // Tracks which session has been "fully loaded" (used to differentiate brand-new sessions from existing ones).
  const loadedIdSessionRef = useRef<string | null>(existingChatSessionId);

  // The chat session object from the global list (if found).
  const selectedChatSession = chatSessions.find(
    (session) => session.id === existingChatSessionId
  );

  // Whether we are actively fetching the messages for the current session.
  const [isFetchingChatMessages, setIsFetchingChatMessages] = useState(
    existingChatSessionId !== null
  );

  // For storing "private/public" status, etc.
  const [chatSessionSharedStatus, setChatSessionSharedStatus] =
    useState<ChatSessionSharedStatus>(
      selectedChatSession?.shared_status ?? ChatSessionSharedStatus.Private
    );

  /**
   * A map of all messages, by session:
   *    Map<  sessionId,  Map<messageId, Message>  >
   */
  const [completeMessageDetail, setCompleteMessageDetail] = useState<
    Map<string | null, Map<number, Message>>
  >(new Map());

  // New state variables
  const [chatState, setChatState] = useState<Map<string | null, ChatState>>(
    new Map([[existingChatSessionId, "input"]])
  );
  const [abortControllers, setAbortControllers] = useState<
    Map<string | null, AbortController>
  >(new Map());

  // New state variable for canContinue
  const [canContinue, setCanContinue] = useState<Map<string | null, boolean>>(
    new Map([[existingChatSessionId, false]])
  );

  /**
   * Update the "completeMessageDetail" for a specific session ID with a fresh Map of messages.
   */
  function updateCompleteMessageDetail(
    sessionId: string | null,
    messageMap: Map<number, Message>
  ) {
    setCompleteMessageDetail((prevState) => {
      const newState = new Map(prevState);
      newState.set(sessionId, messageMap);
      return newState;
    });
  }

  /**
   * Retrieves the message map for the "current" session (pointed to by `chatSessionIdRef`).
   */
  function currentMessageMap(): Map<number, Message> {
    return completeMessageDetail.get(chatSessionIdRef.current) || new Map();
  }

  /**
   * Insert or update messages inside `completeMessageDetail` for a given session,
   * optionally applying a "replacementsMap" (for regenerated messages).
   */
  function upsertToCompleteMessageMap(params: {
    messages: Message[];
    chatSessionId?: string;
    completeMessageMapOverride?: Map<number, Message> | null;
    replacementsMap?: Map<number, number> | null;
    makeLatestChildMessage?: boolean;
  }) {
    const {
      messages,
      chatSessionId,
      completeMessageMapOverride,
      replacementsMap = null,
      makeLatestChildMessage = false,
    } = params;

    // If none is given, we work with the "current" session's map:
    const activeSessionId = chatSessionId || chatSessionIdRef.current;
    const frozenCompleteMessageMap =
      completeMessageMapOverride || currentMessageMap();

    // Shallow clone:
    const newCompleteMessageMap = new Map(frozenCompleteMessageMap);

    // Possibly insert a dummy system message if this is brand new with no prior messages:
    if (newCompleteMessageMap.size === 0 && messages.length > 0) {
      const systemMessageId = messages[0].parentMessageId ?? -3; // SYSTEM_MESSAGE_ID
      const firstMessageId = messages[0].messageId;

      const dummySystemMessage: Message = {
        messageId: systemMessageId,
        message: "",
        type: "system",
        files: [],
        toolCall: null,
        parentMessageId: null,
        childrenMessageIds: [firstMessageId],
        latestChildMessageId: firstMessageId,
      };
      newCompleteMessageMap.set(
        dummySystemMessage.messageId,
        dummySystemMessage
      );
      messages[0].parentMessageId = systemMessageId;
    }

    // Insert messages:
    messages.forEach((msg) => {
      const replacementTargetId = replacementsMap?.get(msg.messageId);
      if (replacementTargetId) {
        removeMessage(replacementTargetId, newCompleteMessageMap);
      }
      // Ensure parent's children list is updated if it's a new message:
      if (!newCompleteMessageMap.has(msg.messageId) && msg.parentMessageId) {
        updateParentChildren(msg, newCompleteMessageMap, true);
      }
      newCompleteMessageMap.set(msg.messageId, msg);
    });

    // If asked, make the new message(s) the "latest" child in the chain
    if (makeLatestChildMessage && messages.length > 0) {
      const oldChain = buildLatestMessageChain(frozenCompleteMessageMap);
      const lastMessage = oldChain[oldChain.length - 1];
      if (lastMessage) {
        newCompleteMessageMap.get(lastMessage.messageId)!.latestChildMessageId =
          messages[0].messageId;
      }
    }

    // Store back into our main map
    updateCompleteMessageDetail(activeSessionId, newCompleteMessageMap);

    return { sessionId: activeSessionId, messageMap: newCompleteMessageMap };
  }

  /**
   * Rebuild the "latest message chain" (linear history) from the messageMap for the active session.
   */
  const messageHistory = buildLatestMessageChain(currentMessageMap());

  /**
   * On mount / whenever `existingChatSessionId` changes, fetch that session's messages if needed.
   */
  useEffect(() => {
    const priorSessionId = chatSessionIdRef.current;
    chatSessionIdRef.current = existingChatSessionId;
    loadedIdSessionRef.current = existingChatSessionId;

    if (existingChatSessionId === null) {
      // No session => we can reset or do nothing:
      setIsFetchingChatMessages(false);
      updateCompleteMessageDetail(null, new Map());
      setChatSessionSharedStatus(ChatSessionSharedStatus.Private);
      return;
    }

    async function loadSession() {
      setIsFetchingChatMessages(true);
      try {
        const resp = await fetch(
          `/api/chat/get-chat-session/${existingChatSessionId}`
        );
        if (!resp.ok) {
          console.error("Failed to fetch chat session from server.");
          setIsFetchingChatMessages(false);
          return;
        }
        const chatSession = (await resp.json()) as BackendChatSession;

        // Update shared status
        setChatSessionSharedStatus(chatSession.shared_status);

        // Convert raw => Map
        const newMessageMap = processRawChatHistory(chatSession.messages);
        updateCompleteMessageDetail(existingChatSessionId, newMessageMap);

        // If the session has no description but does have messages, we rename.
        // (Mimicking original logic that you might have used in ChatPage.)
        if (!chatSession.description && newMessageMap.size > 0) {
          console.log("renameCurrentSessionIfEmpty desc");
          await nameChatSession(existingChatSessionId!);
          refreshChatSessions();
        }
      } catch (err) {
        console.error("Error while loading chat session:", err);
      } finally {
        setIsFetchingChatMessages(false);
      }
    }

    loadSession();
  }, [existingChatSessionId]);

  /**
   * If needed, a little helper to rename the *current* session if it has no description yet.
   */
  async function renameCurrentSessionIfEmpty() {
    console.log("renameCurrentSessionIfEmpty");
    if (!chatSessionIdRef.current) return;
    await nameChatSession(chatSessionIdRef.current);
    refreshChatSessions();
  }

  /**
   * When we create a brand-new session, we can call `handleNewSessionId(newId)`
   * to shift any "null-based" messages to the new ID, etc.
   */
  function handleNewSessionId(newSessionId: string) {
    const existingMessagesForNull = completeMessageDetail.get(null);
    if (existingMessagesForNull) {
      // Move them to the new ID
      updateCompleteMessageDetail(newSessionId, existingMessagesForNull);
      setCompleteMessageDetail((prev) => {
        const clone = new Map(prev);
        clone.delete(null);
        return clone;
      });
    }
    // Now track that we're on the new session
    chatSessionIdRef.current = newSessionId;
    loadedIdSessionRef.current = newSessionId;
  }

  // New helper functions
  function currentChatState(): ChatState {
    return chatState.get(chatSessionIdRef.current!) || "input";
  }

  function updateChatState(state: ChatState) {
    setChatState((prev) => {
      const newMap = new Map(prev);
      newMap.set(chatSessionIdRef.current!, state);
      return newMap;
    });
  }

  //   function currentRegenerationState(): RegenerationState | null {
  //     return regenerationState.get(chatSessionIdRef.current!) || null;
  //   }

  //   function updateRegenerationState(state: RegenerationState | null) {
  //     setRegenerationState(
  //       (prev: Map<string | null, RegenerationState | null>) => {
  //         const newMap = new Map(prev);
  //         newMap.set(chatSessionIdRef.current!, state);
  //         return newMap;
  //       }
  //     );
  //   }

  function resetRegenerationState() {
    updateRegenerationState(null);
  }

  function getAbortController(
    sessionId: string | null
  ): AbortController | undefined {
    return abortControllers.get(sessionId);
  }

  function setAbortController(
    sessionId: string | null,
    controller: AbortController
  ) {
    setAbortControllers((prev) => {
      const newMap = new Map(prev);
      newMap.set(sessionId, controller);
      return newMap;
    });
  }

  function removeAbortController(sessionId: string | null) {
    setAbortControllers((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  }

  // New helper functions for canContinue
  function currentCanContinue(): boolean {
    return canContinue.get(chatSessionIdRef.current!) || false;
  }

  function updateCanContinue(value: boolean, sessionId?: string | null) {
    setCanContinue((prev) => {
      const newMap = new Map(prev);
      newMap.set(sessionId || chatSessionIdRef.current!, value);
      return newMap;
    });
  }

  return {
    /** Refs to track current session IDs */
    chatSessionIdRef,
    loadedIdSessionRef,

    /** The chat session object from your global array, if present */
    selectedChatSession,

    /** The entire map of messages, plus the function to update it */
    completeMessageDetail,
    updateCompleteMessageDetail,
    upsertToCompleteMessageMap,

    /** The linear chain of messages to display in the UI */
    messageHistory,

    /** Shared/public status, plus setter */
    chatSessionSharedStatus,
    setChatSessionSharedStatus,

    /** Is the session currently being fetched? */
    isFetchingChatMessages,
    setIsFetchingChatMessages,

    /** Some helpers for special flows */
    renameCurrentSessionIfEmpty,
    handleNewSessionId,
    currentMessageMap,

    // New return values
    chatState: currentChatState(),
    updateChatState,
    regenerationState: currentRegenerationState(),
    updateRegenerationState,
    resetRegenerationState,
    getAbortController,
    setAbortController,
    removeAbortController,
    abortControllers,
    setAbortControllers,

    // New return values for canContinue
    canContinue: currentCanContinue(),
    updateCanContinue,
  };
}
