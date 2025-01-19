"use client";

import {
  ReadonlyURLSearchParams,
  redirect,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Prism from "prismjs";
import Cookies from "js-cookie";
import Dropzone from "react-dropzone";
import { v4 as uuidv4 } from "uuid";
import { FiArrowDown } from "react-icons/fi";

export interface RegenerationRequest {
  messageId: number;
  parentMessage: Message;
  forceSearch?: boolean;
}
import {
  BackendMessage,
  ChatFileType,
  ChatSession,
  ChatSessionSharedStatus,
  FileChatDisplay,
  FileDescriptor,
  Message,
  MessageResponseIDInfo,
  RetrievalType,
  StreamingError,
  ToolCallMetadata,
} from "./interfaces";
// ^ import your actual definitions as needed
import {
  LlmOverrideManager,
  FilterManager,
  LlmOverride,
  useFilters,
  useLlmOverride,
} from "@/lib/hooks";
import {
  buildChatUrl,
  buildLatestMessageChain,
  createChatSession,
  deleteAllChatSessions,
  getCitedDocumentsFromMessage,
  getHumanAndAIMessageFromMessageNumber,
  getLastSuccessfulMessageId,
  handleChatFeedback,
  nameChatSession,
  PacketType,
  personaIncludesRetrieval,
  processRawChatHistory,
  removeMessage,
  sendMessage,
  setMessageAsLatest,
  updateParentChildren,
  uploadFilesForChat,
  useScrollonStream,
} from "./lib";

import { ChatState, FeedbackType, RegenerationState } from "./types";
import { useChatContext } from "@/components/context/ChatContext";
import { useDocumentSelection } from "./useDocumentSelection";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { PopupSpec, usePopup } from "@/components/admin/connectors/Popup";

import { useUser } from "@/components/user/UserProvider";
import { useAssistants } from "@/components/context/AssistantsContext";

import { ChatInputBar } from "./input/ChatInputBar";
import { AIMessage, HumanMessage } from "./message/Messages";
import { ChatIntro } from "./ChatIntro";
import { StarterMessages } from "../../components/assistants/StarterMessage";
import { DocumentResults } from "./documentSidebar/DocumentResults";
import { FeedbackModal } from "./modal/FeedbackModal";
import { ShareChatSessionModal } from "./modal/ShareChatSessionModal";
import { HealthCheckBanner } from "@/components/health/healthcheck";
import { HistorySidebar } from "./sessionSidebar/HistorySidebar";

import { ApiKeyModal } from "@/components/llm/ApiKeyModal";
import { ChatPopup } from "./ChatPopup";
import FunctionalHeader from "@/components/chat_search/Header";
import TextView from "@/components/chat_search/TextView";
import { MinimalMarkdown } from "@/components/chat_search/MinimalMarkdown";
import ExceptionTraceModal from "@/components/modals/ExceptionTraceModal";
import { DeleteEntityModal } from "../../components/modals/DeleteEntityModal";
import { OnyxInitializingLoader } from "@/components/OnyxInitializingLoader";
import { NoAssistantModal } from "@/components/modals/NoAssistantModal";
import { UserSettingsModal } from "./modal/UserSettingsModal";
import AssistantModal from "../assistants/mine/AssistantModal";

import {
  checkLLMSupportsImageInput,
  destructureValue,
  getFinalLLM,
  getLLMProviderOverrideForPersona,
} from "@/lib/llm/utils";

import {
  CHROME_MESSAGE,
  SUBMIT_MESSAGE_TYPES,
} from "@/lib/extension/constants";
import { useSendMessageToParent } from "@/lib/extension/utils";
import { SEARCH_PARAM_NAMES, shouldSubmitOnLoad } from "./searchParams";
import { StreamStopInfo, StreamStopReason } from "@/lib/search/interfaces";

import { useSidebarVisibility } from "@/components/chat_search/hooks";
import { SIDEBAR_TOGGLED_COOKIE_NAME } from "@/components/resizable/constants";
import FixedLogo from "./shared_chat_search/FixedLogo";
import BlurBackground from "./shared_chat_search/BlurBackground";
import { useChatSession } from "@/hooks/chat/useChatSession";
import { Persona } from "../admin/assistants/interfaces";
import {
  DocumentInfoPacket,
  AnswerPiecePacket,
  OnyxDocument,
} from "@/lib/search/interfaces";
import { Modal } from "@/components/Modal";
import { buildFilters } from "@/lib/search/utils";
import { SEARCH_TOOL_NAME } from "./tools/constants";
import { getSourceMetadata } from "@/lib/sources";
import { useChatScrolling, useVirtualMessages } from "./hooks/scroll";
import { LLMProviderDescriptor } from "../admin/configuration/llm/interfaces";

const TEMP_USER_MESSAGE_ID = -1;
const TEMP_ASSISTANT_MESSAGE_ID = -2;
const SYSTEM_MESSAGE_ID = -3;
const BUFFER_COUNT = 20; // or whichever value suits your pagination

async function updateCurrentMessageFIFO(
  stack: CurrentMessageFIFO,
  params: any
) {
  try {
    for await (const packet of sendMessage(params)) {
      if (params.signal?.aborted) {
        throw new Error("AbortError");
      }
      stack.push(packet);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.debug("Stream aborted");
      } else {
        stack.error = error.message;
      }
    } else {
      stack.error = String(error);
    }
  } finally {
    stack.isComplete = true;
  }
}
class CurrentMessageFIFO {
  private stack: PacketType[] = [];
  isComplete: boolean = false;
  error: string | null = null;

  push(packetBunch: PacketType) {
    this.stack.push(packetBunch);
  }

  nextPacket(): PacketType | undefined {
    return this.stack.shift();
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }
}

export const useSendMessage = ({
  abortControllers,
  llmProviders,
  setSubmittedMessage,
  setPopup,
  setAlternativeGeneratingAssistant,
  scrollToBottom,
  chatSessionIdRef,
  searchParams,
  messageHistory,
  currentMessageMap,
  currentSessionId,
  currentChatState,
  updateCanContinue,
  liveAssistant,
  handleNewSessionId,
  setAbortControllers,
  updateRegenerationState,
  resetRegenerationState,
  updateChatState,
  message,
  currentMessageFiles,
  selectedDocuments,
  resetInputBar,
  alternativeAssistant,
  filterManager,
  setChatState,
  setLoadingError,
  llmOverrideManager,
  setSelectedMessageForDocDisplay,
  upsertToCompleteMessageMap,
  setCurrentMessageFiles,
}: {
  abortControllers: Map<string | null, AbortController>;
  llmProviders: LLMProviderDescriptor[];
  currentSessionId: () => string;
  setSubmittedMessage: (message: string) => void;
  setPopup: (popup: PopupSpec) => void;
  setAlternativeGeneratingAssistant: (assistant: Persona | null) => void;
  scrollToBottom: () => void;
  chatSessionIdRef: React.RefObject<string | null>;
  searchParams: ReadonlyURLSearchParams;
  messageHistory: Message[];
  currentMessageMap: () => Map<number, Message>;
  currentChatState: () => string;
  updateCanContinue: (canContinue: boolean) => void;
  liveAssistant: Persona;
  handleNewSessionId: (sessionId: string) => void;
  setAbortControllers: (
    value: SetStateAction<Map<string | null, AbortController>>
  ) => void;
  updateRegenerationState: (state: RegenerationState | null) => void;
  resetRegenerationState: () => void;
  updateChatState: (state: ChatState) => void;
  message: string;
  currentMessageFiles: FileDescriptor[];
  selectedDocuments: OnyxDocument[];
  resetInputBar: () => void;
  alternativeAssistant: Persona | null;
  filterManager: FilterManager;
  setChatState: Dispatch<SetStateAction<Map<string | null, ChatState>>>;
  setLoadingError: Dispatch<SetStateAction<string | null>>;
  llmOverrideManager: LlmOverrideManager;
  setSelectedMessageForDocDisplay: (messageId: number) => void;
  upsertToCompleteMessageMap: (params: {
    messages: Message[];
    replacementsMap?: Map<number, number>;
    completeMessageMapOverride?: Map<number, Message>;
    chatSessionId?: string;
  }) => { messageMap: Map<number, Message> };
  setCurrentMessageFiles: Dispatch<SetStateAction<FileDescriptor[]>>;
}) => {
  const { refreshChatSessions } = useChatContext();
  const router = useRouter();

  function createRegenerator(rr: RegenerationRequest) {
    return async function (modelOverride: LlmOverride) {
      return onSubmit({
        messageIdToResend: rr.parentMessage.messageId,
        regenerationRequest: rr,
        forceSearch: rr.forceSearch,
        modelOverRide: modelOverride,
      });
    };
  }

  const onSubmit = async ({
    messageIdToResend,
    messageOverride,
    queryOverride,
    forceSearch,
    isSeededChat,
    alternativeAssistantOverride = null,
    modelOverRide,
    regenerationRequest,
    overrideFileDescriptors,
  }: {
    messageIdToResend?: number;
    messageOverride?: string;
    queryOverride?: string;
    forceSearch?: boolean;
    isSeededChat?: boolean;
    alternativeAssistantOverride?: Persona | null;
    modelOverRide?: LlmOverride;
    regenerationRequest?: RegenerationRequest | null;
    overrideFileDescriptors?: FileDescriptor[];
  } = {}) => {
    let frozenSessionId = currentSessionId();
    updateCanContinue(false);

    if (currentChatState() != "input") {
      if (currentChatState() == "uploading") {
        setPopup({
          message: "Please wait for the content to upload",
          type: "error",
        });
      } else {
        setPopup({
          message: "Please wait for the response to complete",
          type: "error",
        });
      }

      return;
    }

    setAlternativeGeneratingAssistant(alternativeAssistantOverride);

    scrollToBottom();

    let currChatSessionId: string;
    const isNewSession = chatSessionIdRef.current === null;

    const searchParamBasedChatSessionName =
      searchParams.get(SEARCH_PARAM_NAMES.TITLE) || null;

    if (isNewSession) {
      currChatSessionId = await createChatSession(
        liveAssistant?.id || 0,
        searchParamBasedChatSessionName
      );
      handleNewSessionId(currChatSessionId);
    } else {
      currChatSessionId = chatSessionIdRef.current as string;
    }
    frozenSessionId = currChatSessionId;

    const controller = new AbortController();

    setAbortControllers((prev) =>
      new Map(prev).set(currChatSessionId, controller)
    );

    const messageToResend = messageHistory.find(
      (message) => message.messageId === messageIdToResend
    );

    updateRegenerationState(
      regenerationRequest
        ? { regenerating: true, finalMessageIndex: messageIdToResend || 0 }
        : null
    );
    const messageMap = currentMessageMap();
    const messageToResendParent =
      messageToResend?.parentMessageId !== null &&
      messageToResend?.parentMessageId !== undefined
        ? messageMap.get(messageToResend.parentMessageId)
        : null;
    const messageToResendIndex = messageToResend
      ? messageHistory.indexOf(messageToResend)
      : null;

    if (!messageToResend && messageIdToResend !== undefined) {
      setPopup({
        message:
          "Failed to re-send message - please refresh the page and try again.",
        type: "error",
      });
      resetRegenerationState();
      updateChatState("input");
      return;
    }
    let currMessage = messageToResend ? messageToResend.message : message;
    if (messageOverride) {
      currMessage = messageOverride;
    }

    setSubmittedMessage(currMessage);

    updateChatState("loading");

    const currMessageHistory =
      messageToResendIndex !== null
        ? messageHistory.slice(0, messageToResendIndex)
        : messageHistory;

    let parentMessage =
      messageToResendParent ||
      (currMessageHistory.length > 0
        ? currMessageHistory[currMessageHistory.length - 1]
        : null) ||
      (messageMap.size === 1 ? Array.from(messageMap.values())[0] : null);

    const currentAssistantId = alternativeAssistantOverride
      ? alternativeAssistantOverride.id
      : alternativeAssistant
        ? alternativeAssistant.id
        : liveAssistant.id;

    resetInputBar();
    let messageUpdates: Message[] | null = null;

    let answer = "";

    const stopReason: StreamStopReason | null = null;
    let query: string | null = null;
    let retrievalType: RetrievalType =
      selectedDocuments.length > 0
        ? RetrievalType.SelectedDocs
        : RetrievalType.None;
    let documents: OnyxDocument[] = selectedDocuments;
    let aiMessageImages: FileDescriptor[] | null = null;
    let error: string | null = null;
    let stackTrace: string | null = null;

    let finalMessage: BackendMessage | null = null;
    let toolCall: ToolCallMetadata | null = null;

    let initialFetchDetails: null | {
      user_message_id: number;
      assistant_message_id: number;
      frozenMessageMap: Map<number, Message>;
    } = null;
    try {
      const mapKeys = Array.from(currentMessageMap().keys());
      const systemMessage = Math.min(...mapKeys);

      const lastSuccessfulMessageId =
        getLastSuccessfulMessageId(currMessageHistory) || systemMessage;

      const stack = new CurrentMessageFIFO();
      updateCurrentMessageFIFO(stack, {
        signal: controller.signal,
        message: currMessage,
        alternateAssistantId: currentAssistantId,
        fileDescriptors: overrideFileDescriptors || currentMessageFiles,
        parentMessageId:
          regenerationRequest?.parentMessage.messageId ||
          lastSuccessfulMessageId,
        chatSessionId: currChatSessionId,
        promptId: liveAssistant?.prompts[0]?.id || 0,
        filters: buildFilters(
          filterManager.selectedSources,
          filterManager.selectedDocumentSets,
          filterManager.timeRange,
          filterManager.selectedTags
        ),
        selectedDocumentIds: selectedDocuments
          .filter(
            (document) =>
              document.db_doc_id !== undefined && document.db_doc_id !== null
          )
          .map((document) => document.db_doc_id as number),
        queryOverride,
        forceSearch,
        regenerate: regenerationRequest !== undefined,
        modelProvider:
          modelOverRide?.name ||
          llmOverrideManager.llmOverride.name ||
          llmOverrideManager.globalDefault.name ||
          undefined,
        modelVersion:
          modelOverRide?.modelName ||
          llmOverrideManager.llmOverride.modelName ||
          searchParams.get(SEARCH_PARAM_NAMES.MODEL_VERSION) ||
          llmOverrideManager.globalDefault.modelName ||
          undefined,
        temperature: llmOverrideManager.temperature || undefined,
        systemPromptOverride:
          searchParams.get(SEARCH_PARAM_NAMES.SYSTEM_PROMPT) || undefined,
        useExistingUserMessage: isSeededChat,
      });

      const delay = (ms: number) => {
        return new Promise((resolve) => setTimeout(resolve, ms));
      };

      await delay(50);
      while (!stack.isComplete || !stack.isEmpty()) {
        if (stack.isEmpty()) {
          await delay(0.5);
        }

        if (!stack.isEmpty() && !controller.signal.aborted) {
          const packet = stack.nextPacket();
          if (!packet) {
            continue;
          }
          if (!initialFetchDetails) {
            if (!Object.hasOwn(packet, "user_message_id")) {
              console.error(
                "First packet should contain message response info "
              );
              if (Object.hasOwn(packet, "error")) {
                const error = (packet as StreamingError).error;
                setLoadingError(error);
                updateChatState("input");
                return;
              }
              continue;
            }

            const messageResponseIDInfo = packet as MessageResponseIDInfo;

            const user_message_id = messageResponseIDInfo.user_message_id!;
            const assistant_message_id =
              messageResponseIDInfo.reserved_assistant_message_id;

            // we will use tempMessages until the regenerated message is complete
            messageUpdates = [
              {
                messageId: regenerationRequest
                  ? regenerationRequest?.parentMessage?.messageId!
                  : user_message_id,
                message: currMessage,
                type: "user",
                files: currentMessageFiles,
                toolCall: null,
                parentMessageId: parentMessage?.messageId || SYSTEM_MESSAGE_ID,
              },
            ];

            if (parentMessage && !regenerationRequest) {
              messageUpdates.push({
                ...parentMessage,
                childrenMessageIds: (
                  parentMessage.childrenMessageIds || []
                ).concat([user_message_id]),
                latestChildMessageId: user_message_id,
              });
            }

            const { messageMap: currentFrozenMessageMap } =
              upsertToCompleteMessageMap({
                messages: messageUpdates,
                chatSessionId: currChatSessionId,
              });

            const frozenMessageMap = currentFrozenMessageMap;
            initialFetchDetails = {
              frozenMessageMap,
              assistant_message_id,
              user_message_id,
            };

            resetRegenerationState();
          } else {
            const { user_message_id, frozenMessageMap } = initialFetchDetails;

            setChatState((prevState) => {
              if (prevState.get(chatSessionIdRef.current!) === "loading") {
                return new Map(prevState).set(
                  chatSessionIdRef.current!,
                  "streaming"
                );
              }
              return prevState;
            });

            if (Object.hasOwn(packet, "answer_piece")) {
              answer += (packet as AnswerPiecePacket).answer_piece;
            } else if (Object.hasOwn(packet, "top_documents")) {
              documents = (packet as DocumentInfoPacket).top_documents;
              retrievalType = RetrievalType.Search;
              if (documents && documents.length > 0) {
                // point to the latest message (we don't know the messageId yet, which is why
                // we have to use -1)
                setSelectedMessageForDocDisplay(user_message_id);
              }
            } else if (Object.hasOwn(packet, "tool_name")) {
              // Will only ever be one tool call per message
              toolCall = {
                tool_name: (packet as ToolCallMetadata).tool_name,
                tool_args: (packet as ToolCallMetadata).tool_args,
                tool_result: (packet as ToolCallMetadata).tool_result,
              };

              if (!toolCall.tool_result || toolCall.tool_result == undefined) {
                updateChatState("toolBuilding");
              } else {
                updateChatState("streaming");
              }

              // This will be consolidated in upcoming tool calls udpate,
              // but for now, we need to set query as early as possible
              if (toolCall.tool_name == SEARCH_TOOL_NAME) {
                query = toolCall.tool_args["query"];
              }
            } else if (Object.hasOwn(packet, "file_ids")) {
              aiMessageImages = (packet as FileChatDisplay).file_ids.map(
                (fileId) => {
                  return {
                    id: fileId,
                    type: ChatFileType.IMAGE,
                  };
                }
              );
            } else if (Object.hasOwn(packet, "error")) {
              error = (packet as StreamingError).error;
              stackTrace = (packet as StreamingError).stack_trace;
            } else if (Object.hasOwn(packet, "message_id")) {
              finalMessage = packet as BackendMessage;
            } else if (Object.hasOwn(packet, "stop_reason")) {
              const stop_reason = (packet as StreamStopInfo).stop_reason;
              if (stop_reason === StreamStopReason.CONTEXT_LENGTH) {
                updateCanContinue(true);
              }
            }

            // on initial message send, we insert a dummy system message
            // set this as the parent here if no parent is set
            parentMessage =
              parentMessage || frozenMessageMap?.get(SYSTEM_MESSAGE_ID)!;

            const updateFn = (messages: Message[]) => {
              const replacementsMap = regenerationRequest
                ? new Map([
                    [
                      regenerationRequest?.parentMessage?.messageId,
                      regenerationRequest?.parentMessage?.messageId,
                    ],
                    [
                      regenerationRequest?.messageId,
                      initialFetchDetails?.assistant_message_id,
                    ],
                  ] as [number, number][])
                : null;

              return upsertToCompleteMessageMap({
                messages: messages,
                replacementsMap: replacementsMap || undefined,
                completeMessageMapOverride: frozenMessageMap,
                chatSessionId: frozenSessionId!,
              });
            };

            updateFn([
              {
                messageId: regenerationRequest
                  ? regenerationRequest?.parentMessage?.messageId!
                  : initialFetchDetails.user_message_id!,
                message: currMessage,
                type: "user",
                files: currentMessageFiles,
                toolCall: null,
                parentMessageId: error ? null : lastSuccessfulMessageId,
                childrenMessageIds: [
                  ...(regenerationRequest?.parentMessage?.childrenMessageIds ||
                    []),
                  initialFetchDetails.assistant_message_id!,
                ],
                latestChildMessageId: initialFetchDetails.assistant_message_id,
              },
              {
                messageId: initialFetchDetails.assistant_message_id!,
                message: error || answer,
                type: error ? "error" : "assistant",
                retrievalType,
                query: finalMessage?.rephrased_query || query,
                documents: documents,
                citations: finalMessage?.citations || {},
                files: finalMessage?.files || aiMessageImages || [],
                toolCall: finalMessage?.tool_call || toolCall,
                parentMessageId: regenerationRequest
                  ? regenerationRequest?.parentMessage?.messageId!
                  : initialFetchDetails.user_message_id,
                alternateAssistantID: alternativeAssistant?.id,
                stackTrace: stackTrace,
                overridden_model: finalMessage?.overridden_model,
                stopReason: stopReason,
              },
            ]);
          }
        }
      }
    } catch (e: any) {
      const errorMsg = e.message;
      upsertToCompleteMessageMap({
        messages: [
          {
            messageId:
              initialFetchDetails?.user_message_id || TEMP_USER_MESSAGE_ID,
            message: currMessage,
            type: "user",
            files: currentMessageFiles,
            toolCall: null,
            parentMessageId: parentMessage?.messageId || SYSTEM_MESSAGE_ID,
          },
          {
            messageId:
              initialFetchDetails?.assistant_message_id ||
              TEMP_ASSISTANT_MESSAGE_ID,
            message: errorMsg,
            type: "error",
            files: aiMessageImages || [],
            toolCall: null,
            parentMessageId:
              initialFetchDetails?.user_message_id || TEMP_USER_MESSAGE_ID,
          },
        ],
        completeMessageMapOverride: currentMessageMap(),
      });
    }
    resetRegenerationState();

    updateChatState("input");
    if (isNewSession) {
      if (finalMessage) {
        setSelectedMessageForDocDisplay(finalMessage.message_id);
      }

      if (!searchParamBasedChatSessionName) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        await nameChatSession(currChatSessionId);
        refreshChatSessions();
      }

      // NOTE: don't switch pages if the user has navigated away from the chat
      if (
        currChatSessionId === chatSessionIdRef.current ||
        chatSessionIdRef.current === null
      ) {
        const newUrl = buildChatUrl(searchParams, currChatSessionId, null);
        // newUrl is like /chat?chatId=10
        // current page is like /chat
        router.push(newUrl, { scroll: false });
      }
    }
    if (
      finalMessage?.context_docs &&
      finalMessage.context_docs.top_documents.length > 0 &&
      retrievalType === RetrievalType.Search
    ) {
      setSelectedMessageForDocDisplay(finalMessage.message_id);
    }
    setAlternativeGeneratingAssistant(null);
    setSubmittedMessage("");
  };
  async function handleImageUpload(acceptedFiles: File[]) {
    if (!liveAssistant) return;
    const [, llmModel] = getFinalLLM(
      llmProviders,
      liveAssistant,
      llmOverrideManager.llmOverride
    );
    const supportsImages = checkLLMSupportsImageInput(llmModel);

    const images = acceptedFiles.filter((f) => f.type.startsWith("image/"));
    if (images.length > 0 && !supportsImages) {
      setPopup({
        type: "error",
        message:
          "This Assistant does not support image input. Please use a Vision-capable model.",
      });
      return;
    }

    // Insert placeholders:
    const placeholders = acceptedFiles.map((file) => ({
      id: uuidv4(),
      type: file.type.startsWith("image/")
        ? ChatFileType.IMAGE
        : ChatFileType.DOCUMENT,
      isUploading: true,
    }));
    const totalSize = acceptedFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > 50 * 1024) {
      setCurrentMessageFiles((prev) => [...prev, ...placeholders]);
    }

    updateChatState("uploading");
    const [files, error] = await uploadFilesForChat(acceptedFiles);
    if (error) {
      setCurrentMessageFiles((prev) =>
        prev.filter((fd) => !placeholders.some((ph) => ph.id === fd.id))
      );
      setPopup({ type: "error", message: error });
    } else {
      // remove placeholders, add real files:
      setCurrentMessageFiles((prev) => {
        const withoutPlaceholders = prev.filter(
          (fd) => !placeholders.some((ph) => ph.id === fd.id)
        );
        return [...withoutPlaceholders, ...files];
      });
    }
    updateChatState("input");
  }

  function continueGenerating() {
    onSubmit({
      messageOverride:
        "Continue Generating (pick up exactly where you left off)",
    });
  }

  // The actual "stop" button:
  function stopGenerating() {
    const currSession = currentSessionId();
    const controller = abortControllers.get(currSession);
    if (controller) {
      controller.abort();
      setAbortControllers((prev) => {
        const newMap = new Map(prev);
        newMap.delete(currSession);
        return newMap;
      });
    }
    // fix up message if tool call was partial:
    const lastMsg = messageHistory[messageHistory.length - 1];
    if (
      lastMsg &&
      lastMsg.type === "assistant" &&
      lastMsg.toolCall &&
      lastMsg.toolCall.tool_result === undefined
    ) {
      const cloned = currentMessageMap();
      cloned.set(lastMsg.messageId, { ...lastMsg, toolCall: null });
      upsertToCompleteMessageMap({
        messages: [{ ...lastMsg, toolCall: null }],
        chatSessionId: currSession,
        completeMessageMapOverride: cloned,
      });
    }
    updateChatState("input");
  }

  return {
    onSubmit,
    createRegenerator,
    handleImageUpload,
    continueGenerating,
    stopGenerating,
  };
};
