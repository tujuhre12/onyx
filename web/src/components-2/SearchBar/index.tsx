import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { ChatInputBar } from "@/app/chat/input/ChatInputBar";
import { ChatState } from "@/app/chat/types";
import { FilterManager, LlmManager } from "@/lib/hooks";
import { SourceMetadata } from "@/lib/search/interfaces";
import { DocumentSetSummary, Tag } from "@/lib/types";
import React from "react";

type SearchInputBarProps = {
  message: string;
  setMessage: (message: string) => void;
  stopGenerating: () => void;
  onSubmit: () => void;
  llmManager: LlmManager;
  chatState: ChatState;
  filterManager: FilterManager;
  availableSources: SourceMetadata[];
  availableDocumentSets: DocumentSetSummary[];
  availableTags: Tag[];
};

export default function SearchInputBar(props: SearchInputBarProps) {
  const textAreaRef = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    // Override the placeholder after the component mounts
    if (textAreaRef.current) {
      textAreaRef.current.placeholder = "Search for...";
    }
  }, []);

  function noop() {}

  const mockSelectedAssistant: MinimalPersonaSnapshot = {
    id: 1,
    name: "Mock Assistant",
    description: "Mock assistant for stub",
    tools: [],
    starter_messages: null,
    document_sets: [],
    is_public: true,
    is_visible: true,
    display_priority: null,
    is_default_persona: true,
    builtin_persona: false,
    owner: null,
  };

  return (
    <ChatInputBar
      textAreaRef={textAreaRef}
      enableAgentic={false}
      removeDocs={noop}
      showConfigureAPIKey={noop}
      selectedDocuments={[]}
      selectedAssistant={mockSelectedAssistant}
      alternativeAssistant={null}
      setAlternativeAssistant={noop}
      toggleDocumentSidebar={noop}
      setFiles={noop}
      handleFileUpload={noop}
      retrievalEnabled={true}
      proSearchEnabled={false}
      setProSearchEnabled={noop}
      {...props}
    />
  );
}
