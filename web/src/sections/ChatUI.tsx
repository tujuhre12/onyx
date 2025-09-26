import React, { RefObject, useCallback, useMemo } from "react";
import { Message } from "@/app/chat/interfaces";
import { OnyxDocument } from "@/lib/search/interfaces";
import { ErrorBanner } from "@/app/chat/message/Resubmit";
import { FeedbackType } from "@/app/chat/interfaces";
import { LlmDescriptor, useLlmManager } from "@/lib/hooks";
import {
  FileResponse,
  FolderResponse,
  useDocumentsContext,
} from "@/app/chat/my-documents/DocumentsContext";
import { FileDescriptor } from "@/app/chat/interfaces";
import { MemoizedAIMessage } from "@/app/chat/message/messageComponents/MemoizedAIMessage";
import { cn } from "@/lib/utils";
import {
  useCurrentMessageHistory,
  useCurrentMessageTree,
  useHasPerformedInitialScroll,
  useLoadingError,
  useUncaughtError,
} from "@/app/chat/stores/useChatSessionStore";
import { useAgentsContext } from "@/components-2/context/AgentsContext";
import { useChatContext } from "@/components-2/context/ChatContext";
import { useDeepResearchToggle } from "@/app/chat/hooks/useDeepResearchToggle";
import HumanMessage from "@/components-2/messages/HumanMessage";

export interface ChatUIProps {
  setCurrentFeedback: (feedback: [FeedbackType, number] | null) => void;
  onSubmit: (args: {
    message: string;
    messageIdToResend?: number;
    selectedFiles: FileResponse[];
    selectedFolders: FolderResponse[];
    currentMessageFiles: FileDescriptor[];
    useAgentSearch: boolean;
    modelOverride?: LlmDescriptor;
    regenerationRequest?: {
      messageId: number;
      parentMessage: Message;
      forceSearch?: boolean;
    };
    forceSearch?: boolean;
    queryOverride?: string;
    isSeededChat?: boolean;
    overrideFileDescriptors?: FileDescriptor[];
  }) => Promise<void>;
  onMessageSelection: (nodeId: number) => void;
  stopGenerating: () => void;
  handleResubmitLastMessage: () => void;
  lastMessageRef: RefObject<HTMLDivElement>;
  endDivRef: RefObject<HTMLDivElement>;
}

export function ChatUI({
  setCurrentFeedback,
  onSubmit,
  onMessageSelection,
  stopGenerating,
  handleResubmitLastMessage,
  lastMessageRef,
  endDivRef,
}: ChatUIProps) {
  const messageHistory = useCurrentMessageHistory();
  const completeMessageTree = useCurrentMessageTree();
  const { currentAgent, fallbackAgent } = useAgentsContext();
  const { currentChat, llmProviders } = useChatContext();
  const llmManager = useLlmManager(
    llmProviders,
    currentChat || undefined,
    currentAgent || undefined
  );
  const { deepResearchEnabled } = useDeepResearchToggle({
    chatSessionId: currentChat?.id ?? null,
    assistantId: currentAgent?.id,
  });
  const {
    selectedFiles,
    selectedFolders,
    currentMessageFiles,
    setPresentingDocument,
  } = useDocumentsContext();
  const loadingError = useLoadingError();
  const hasPerformedInitialScroll = useHasPerformedInitialScroll();
  const uncaughtError = useUncaughtError();

  // Stable fallbacks to avoid changing prop identities on each render
  const emptyDocs = useMemo<OnyxDocument[]>(() => [], []);
  const emptyChildrenIds = useMemo<number[]>(() => [], []);
  const createRegenerator = useCallback(
    (regenerationRequest: {
      messageId: number;
      parentMessage: Message;
      forceSearch?: boolean;
    }) => {
      return async (modelOverride: LlmDescriptor) => {
        return await onSubmit({
          message: regenerationRequest.parentMessage.message,
          selectedFiles,
          selectedFolders,
          currentMessageFiles,
          useAgentSearch: deepResearchEnabled,
          modelOverride,
          messageIdToResend: regenerationRequest.parentMessage.messageId,
          regenerationRequest,
          forceSearch: regenerationRequest.forceSearch,
        });
      };
    },
    [
      onSubmit,
      deepResearchEnabled,
      selectedFiles,
      selectedFolders,
      currentMessageFiles,
    ]
  );

  const handleFeedback = useCallback(
    (feedback: FeedbackType, messageId: number) => {
      setCurrentFeedback([feedback, messageId!]);
    },
    [setCurrentFeedback]
  );

  return (
    <div
      key={currentChat?.id}
      className={cn("w-full h-full", !hasPerformedInitialScroll && "hidden")}
    >
      {messageHistory.map((message, index) => {
        const messageReactComponentKey = `message-${message.nodeId}`;
        const parentMessage = message.parentNodeId
          ? completeMessageTree?.get(message.parentNodeId)
          : null;

        if (message.type === "user")
          return (
            <div id={messageReactComponentKey} key={messageReactComponentKey}>
              <HumanMessage
                message={message}
                onMessageSelection={onMessageSelection}
              />
            </div>
          );
        else if (message.type === "assistant") {
          if (
            (uncaughtError || loadingError) &&
            index === messageHistory.length - 1
          ) {
            return (
              <div
                key={`error-${message.nodeId}`}
                className="max-w-message-max mx-auto"
              >
                <ErrorBanner
                  resubmit={handleResubmitLastMessage}
                  error={uncaughtError || loadingError || ""}
                />
              </div>
            );
          }

          // NOTE: it's fine to use the previous entry in messageHistory
          // since this is a "parsed" version of the message tree
          // so the previous message is guaranteed to be the parent of the current message
          const previousMessage =
            index !== 0 ? messageHistory[index - 1] : null;
          return (
            <div
              id={messageReactComponentKey}
              key={messageReactComponentKey}
              ref={index === messageHistory.length - 1 ? lastMessageRef : null}
            >
              <MemoizedAIMessage
                rawPackets={message.packets}
                handleFeedbackWithMessageId={handleFeedback}
                assistant={fallbackAgent}
                docs={message.documents ?? emptyDocs}
                citations={message.citations}
                setPresentingDocument={setPresentingDocument}
                createRegenerator={createRegenerator}
                parentMessage={previousMessage!}
                messageId={message.messageId}
                overriddenModel={llmManager.currentLlm?.modelName}
                nodeId={message.nodeId}
                otherMessagesCanSwitchTo={
                  parentMessage?.childrenNodeIds ?? emptyChildrenIds
                }
                onMessageSelection={onMessageSelection}
              />
            </div>
          );
        }
      })}

      {((uncaughtError !== null || loadingError !== null) &&
        messageHistory[messageHistory.length - 1]?.type === "user") ||
        (messageHistory[messageHistory.length - 1]?.type === "error" && (
          <div className="max-w-message-max mx-auto">
            <ErrorBanner
              resubmit={handleResubmitLastMessage}
              error={uncaughtError || loadingError || ""}
            />
          </div>
        ))}

      <div ref={endDivRef} />
    </div>
  );
}
