import {
  OnyxDocument,
  Filters,
  SearchOnyxDocument,
  StreamStopReason,
  SubQuestionPiece,
  SubQueryPiece,
} from "@/lib/search/interfaces";

export enum RetrievalType {
  None = "none",
  Search = "search",
  SelectedDocs = "selectedDocs",
}

export enum ChatSessionSharedStatus {
  Private = "private",
  Public = "public",
}

// The number of messages to buffer on the client side.
export const BUFFER_COUNT = 35;

export interface RetrievalDetails {
  run_search: "always" | "never" | "auto";
  real_time: boolean;
  filters?: Filters;
  enable_auto_detect_filters?: boolean | null;
}

type CitationMap = { [key: string]: number };

export enum ChatFileType {
  IMAGE = "image",
  DOCUMENT = "document",
  PLAIN_TEXT = "plain_text",
  CSV = "csv",
}

export interface FileDescriptor {
  id: string;
  type: ChatFileType;
  name?: string | null;

  // FE only
  isUploading?: boolean;
}

export interface LLMRelevanceFilterPacket {
  relevant_chunk_indices: number[];
}

export interface ToolCallMetadata {
  tool_name: string;
  tool_args: Record<string, any>;
  tool_result?: Record<string, any>;
}

export interface ToolCallFinalResult {
  tool_name: string;
  tool_args: Record<string, any>;
  tool_result: Record<string, any>;
}

export interface ChatSession {
  id: string;
  name: string;
  persona_id: number;
  time_created: string;
  shared_status: ChatSessionSharedStatus;
  folder_id: number | null;
  current_alternate_model: string;
}

export interface SearchSession {
  search_session_id: string;
  documents: SearchOnyxDocument[];
  messages: BackendMessage[];
  description: string;
}

export interface Message {
  messageId: number;
  message: string;
  type: "user" | "assistant" | "system" | "error";
  retrievalType?: RetrievalType;
  query?: string | null;
  documents?: OnyxDocument[] | null;
  citations?: CitationMap;
  files: FileDescriptor[];
  toolCall: ToolCallMetadata | null;
  // for rebuilding the message tree
  parentMessageId: number | null;
  childrenMessageIds?: number[];
  latestChildMessageId?: number | null;
  alternateAssistantID?: number | null;
  stackTrace?: string | null;
  overridden_model?: string;
  stopReason?: StreamStopReason | null;
  sub_questions?: SubQuestionDetail[] | null;
}

export interface BackendChatSession {
  chat_session_id: string;
  description: string;
  persona_id: number;
  persona_name: string;
  persona_icon_color: string | null;
  persona_icon_shape: number | null;
  messages: BackendMessage[];
  time_created: string;
  shared_status: ChatSessionSharedStatus;
  current_alternate_model?: string;
}

export interface SubQueryDetail {
  query: string;
  query_id: number;
  doc_ids?: number[] | null;
}

export interface BackendMessage {
  message_id: number;
  message_type: string;
  parent_message: number | null;
  latest_child_message: number | null;
  message: string;
  rephrased_query: string | null;
  context_docs: { top_documents: OnyxDocument[] } | null;
  time_sent: string;
  overridden_model: string;
  alternate_assistant_id: number | null;
  chat_session_id: string;
  citations: CitationMap | null;
  files: FileDescriptor[];
  tool_call: ToolCallFinalResult | null;

  sub_questions: SubQuestionDetail[];
  // Keeping existing properties
  comments: any;
  parentMessageId: number | null;
}

export interface MessageResponseIDInfo {
  user_message_id: number | null;
  reserved_assistant_message_id: number;
}

export interface DocumentsResponse {
  top_documents: OnyxDocument[];
  rephrased_query: string | null;
}

export interface FileChatDisplay {
  file_ids: string[];
}

export interface StreamingError {
  error: string;
  stack_trace: string;
}

export interface InputPrompt {
  id: number;
  prompt: string;
  content: string;
  active: boolean;
  is_public: boolean;
}

export interface EditPromptModalProps {
  onClose: () => void;

  promptId: number;
  editInputPrompt: (
    promptId: number,
    values: CreateInputPromptRequest
  ) => Promise<void>;
}
export interface CreateInputPromptRequest {
  prompt: string;
  content: string;
}

export interface AddPromptModalProps {
  onClose: () => void;
  onSubmit: (promptData: CreateInputPromptRequest) => void;
}
export interface PromptData {
  id: number;
  prompt: string;
  content: string;
}
// We need to update the constructSubQuestions function so it can take in either SubQueryDetail or SubQuestionDetail and given current state of subQuestions, build it up

/**
 * // Start of Selection
 */
export interface SubQuestionDetail {
  level: number;
  level_question_nr: number;
  question: string;
  answer: string;
  sub_queries?: SubQueryDetail[] | null;
  context_docs?: { top_documents: OnyxDocument[] } | null;
}

export const constructSubQuestions = (
  subQuestions: SubQuestionDetail[],
  newDetail: SubQuestionPiece | SubQueryPiece
): SubQuestionDetail[] => {
  if (!newDetail) {
    return subQuestions;
  }

  // If it looks like a SubQuestionDetail (contains "question" and "answer"),
  // transform it to a valid SubQuestionDetail and add to the list.
  if (
    "question" in newDetail &&
    typeof newDetail.question === "string" &&
    "answer" in newDetail &&
    typeof newDetail.answer === "string"
  ) {
    const subQuestion: SubQuestionDetail = {
      level: newDetail.level,
      level_question_nr: newDetail.level_question_nr,
      question: newDetail.question,
      answer: newDetail.answer,
      sub_queries: [],
      context_docs: undefined,
    };
    return [...subQuestions, subQuestion];
  } else {
    // Otherwise, treat it as a SubQueryDetail and attach it to the last SubQuestion (if any).
    if (subQuestions.length === 0) {
      return subQuestions;
    }
    const updatedSubQuestions = [...subQuestions];
    const lastIndex = updatedSubQuestions.length - 1;
    const lastSub = { ...updatedSubQuestions[lastIndex] };

    const subQueryDetail: SubQueryDetail = {
      query: ("sub_query" in newDetail && newDetail.sub_query) || "",
      query_id: ("query_id" in newDetail && newDetail.query_id) || 0,
    };

    lastSub.sub_queries = lastSub.sub_queries
      ? [...lastSub.sub_queries, subQueryDetail]
      : [subQueryDetail];

    updatedSubQuestions[lastIndex] = lastSub;
    return updatedSubQuestions;
  }
};
