import React, { useContext, useEffect, useRef, useState } from "react";
import {
  FiPlusCircle,
  FiPlus,
  FiInfo,
  FiX,
  FiSearch,
  FiFilter,
} from "react-icons/fi";
import { ChatInputOption } from "./ChatInputOption";
import { Persona } from "@/app/admin/assistants/interfaces";

import { FilterManager, LlmOverrideManager } from "@/lib/hooks";
import { useChatContext } from "@/components/context/ChatContext";
import { getFinalLLM } from "@/lib/llm/utils";
import { ChatFileType, FileDescriptor } from "../interfaces";
import {
  InputBarPreview,
  InputBarPreviewImageProvider,
} from "../files/InputBarPreview";
import {
  AnthropicIcon,
  AnthropicSVG,
  AssistantsIconSkeleton,
  AWSIcon,
  FileIcon,
  OnyxIcon,
  OpenAIIcon,
  OpenAISVG,
  SendIcon,
  StopGeneratingIcon,
} from "@/components/icons/icons";
import { OnyxDocument, SourceMetadata } from "@/lib/search/interfaces";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Hoverable } from "@/components/Hoverable";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { ChatState } from "../types";
import UnconfiguredProviderText from "@/components/chat_search/UnconfiguredProviderText";
import { useAssistants } from "@/components/context/AssistantsContext";
import { Upload, XIcon } from "lucide-react";
import { fetchTitleFromUrl } from "@/lib/sources";
import { FilterPopup } from "@/components/search/filtering/FilterPopup";
import { DocumentSet, Tag, ValidSources } from "@/lib/types";
import { DateRange } from "react-day-picker";
import { SourceCategory } from "@/lib/search/interfaces";
import { SourceIcon } from "@/components/SourceIcon";

const MAX_INPUT_HEIGHT = 200;

export const SourceChip = ({
  source,
  onRemove,
}: {
  source: SourceMetadata;
  onRemove: () => void;
}) => (
  <div
    className="
        flex
        items-center
        px-2
        bg-hover
        text-sm
        border
        gap-x-1.5
        border-border
        rounded-md
        box-border
        gap-x-1
        h-8"
  >
    <SourceIcon sourceType={source.internalName} iconSize={16} />
    {source.displayName}
    <XIcon
      size={16}
      className="text-text-900 ml-auto cursor-pointer"
      onClick={onRemove}
    />
  </div>
);

const SelectedUrlChip = ({
  url,
  onRemove,
}: {
  url: string;
  onRemove: (url: string) => void;
}) => (
  <div className="bg-white border border-gray-200 shadow-sm rounded-lg p-2 flex items-center space-x-2">
    <img
      src={`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`}
      alt="Website favicon"
      className="w-4 h-4"
    />
    <p className="text-sm font-medium text-gray-700 truncate">
      {new URL(url).hostname}
    </p>
    <XIcon
      onClick={() => onRemove(url)}
      size={16}
      className="text-text-400 hover:text-text-600 ml-auto cursor-pointer"
    />
  </div>
);

const SentUrlChip = ({
  url,
  onRemove,
  onClick,
  title,
}: {
  url: string;
  onRemove: (url: string) => void;
  onClick: () => void;
  title: string;
}) => {
  return (
    <button
      className="bg-white/80 opacity-50 group-hover:opacity-100 border border-gray-200/50 shadow-sm rounded-lg p-2 flex items-center space-x-2  hover:bg-white hover:border-gray-200 transition-all duration-200"
      onClick={onClick}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${
          new URL(url).hostname
        }`}
        alt="Website favicon"
        className="w-4 h-4 "
      />
      <p className="text-sm font-medium text-gray-600 truncate group-hover:text-gray-700">
        {title}
      </p>
      <XIcon
        onClick={(e) => {
          onRemove(url);
        }}
        size={16}
        className="text-text-300 hover:text-text-500 ml-auto transition-colors duration-200"
      />
    </button>
  );
};

interface ChatInputBarProps {
  removeDocs: () => void;
  showDocs: () => void;
  showConfigureAPIKey: () => void;
  selectedDocuments: OnyxDocument[];
  message: string;
  setMessage: (message: string) => void;
  stopGenerating: () => void;
  onSubmit: () => void;
  llmOverrideManager: LlmOverrideManager;
  chatState: ChatState;
  alternativeAssistant: Persona | null;
  // assistants
  selectedAssistant: Persona;
  setAlternativeAssistant: (alternativeAssistant: Persona | null) => void;

  files: FileDescriptor[];
  setFiles: (files: FileDescriptor[]) => void;
  handleFileUpload: (files: File[]) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  toggleFilters?: () => void;
  filterManager: FilterManager;
  availableSources: SourceMetadata[];
  availableDocumentSets: DocumentSet[];
  availableTags: Tag[];
}

export function ChatInputBar({
  removeDocs,
  showDocs,
  filterManager,
  showConfigureAPIKey,
  selectedDocuments,
  message,
  setMessage,
  stopGenerating,
  onSubmit,
  chatState,

  // assistants
  selectedAssistant,
  setAlternativeAssistant,

  files,
  setFiles,
  handleFileUpload,
  textAreaRef,
  alternativeAssistant,
  toggleFilters,
  availableSources,
  availableDocumentSets,
  availableTags,
}: ChatInputBarProps) {
  useEffect(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "0px";
      textarea.style.height = `${Math.min(
        textarea.scrollHeight,
        MAX_INPUT_HEIGHT
      )}px`;
    }
  }, [message, textAreaRef]);

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (items) {
      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        event.preventDefault();
        handleFileUpload(pastedFiles);
      }
    }
  };

  const settings = useContext(SettingsContext);
  const { finalAssistants: assistantOptions } = useAssistants();

  const { llmProviders } = useChatContext();
  const [_, llmName] = getFinalLLM(llmProviders, selectedAssistant, null);

  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const interactionsRef = useRef<HTMLDivElement | null>(null);

  const hideSuggestions = () => {
    setShowSuggestions(false);
    setTabbingIconIndex(0);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        (!interactionsRef.current ||
          !interactionsRef.current.contains(event.target as Node))
      ) {
        hideSuggestions();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const updatedTaggedAssistant = (assistant: Persona) => {
    setAlternativeAssistant(
      assistant.id == selectedAssistant.id ? null : assistant
    );
    hideSuggestions();
    setMessage("");
  };

  const handleAssistantInput = (text: string) => {
    if (!text.startsWith("@")) {
      hideSuggestions();
    } else {
      const match = text.match(/(?:\s|^)@(\w*)$/);
      if (match) {
        setShowSuggestions(true);
      } else {
        hideSuggestions();
      }
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setMessage(text);
    handleAssistantInput(text);
  };

  const assistantTagOptions = assistantOptions.filter((assistant) =>
    assistant.name.toLowerCase().startsWith(
      message
        .slice(message.lastIndexOf("@") + 1)
        .split(/\s/)[0]
        .toLowerCase()
    )
  );

  const [tabbingIconIndex, setTabbingIconIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      showSuggestions &&
      assistantTagOptions.length > 0 &&
      (e.key === "Tab" || e.key == "Enter")
    ) {
      e.preventDefault();

      if (tabbingIconIndex == assistantTagOptions.length && showSuggestions) {
        window.open("/assistants/new", "_self");
      } else {
        const option =
          assistantTagOptions[tabbingIconIndex >= 0 ? tabbingIconIndex : 0];

        updatedTaggedAssistant(option);
      }
    }
    if (!showSuggestions) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();

      setTabbingIconIndex((tabbingIconIndex) =>
        Math.min(tabbingIconIndex + 1, assistantTagOptions.length)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTabbingIconIndex((tabbingIconIndex) =>
        Math.max(tabbingIconIndex - 1, 0)
      );
    }
  };

  const [timeRange, setTimeRange] = React.useState<DateRange | undefined>(
    undefined
  );
  const [selectedSources, setSelectedSources] = React.useState<string[]>([]);

  // const filterTypes: FilterType[] = [
  //   {
  //     name: "Sources",
  //     icon: <FiFilter size={14} />,
  //     options: filterManager.selectedSources.map((source) => ({
  //       key: source.internalName,
  //       display: source.displayName,
  //     })),
  //     selected: filterManager.selectedSources.map(
  //       (source) => source.internalName
  //     ),
  //     onSelect: (option) => {
  //       const source = filterManager.selectedSources.find(
  //         (s) => s.internalName === option.key
  //       );
  //       if (source) {
  //         filterManager.setSelectedSources((prev) =>
  //           prev.filter((s) => s.internalName !== option.key)
  //         );
  //       } else {
  //         const newSource = getSourceMetadata(
  //           option.key,
  //           option.display as string
  //         );
  //         if (newSource) {
  //           filterManager.setSelectedSources((prev) => [...prev, newSource]);
  //         }
  //       }
  //     },
  //     onReset: () => filterManager.setSelectedSources([]),
  //   },
  //   // Add more filter types as needed
  // ];

  const getSourceMetadata = (
    internalName: string,
    displayName: string
  ): SourceMetadata | null => {
    // This is a placeholder implementation. You should replace this with actual logic
    // to get the full SourceMetadata object based on your application's needs.
    return {
      internalName: internalName as ValidSources,
      displayName,
      icon: () => null, // Replace with actual icon component
      category: "web" as SourceCategory, // Replace with actual category
      adminUrl: "", // Replace with actual admin URL if applicable
    };
  };

  return (
    <div id="onyx-chat-input">
      <div className="flex  justify-center mx-auto">
        <div
          className="
            w-[800px]
            relative
            desktop:px-4
            mx-auto
          "
        >
          {showSuggestions && assistantTagOptions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="text-sm absolute inset-x-0 top-0 w-full transform -translate-y-full"
            >
              <div className="rounded-lg py-1 sm-1.5 bg-background border border-border-medium shadow-lg mx-2 px-1.5 mt-2 z-10">
                {assistantTagOptions.map((currentAssistant, index) => (
                  <button
                    key={index}
                    className={`px-2 ${
                      tabbingIconIndex == index && "bg-hover-lightish"
                    } rounded items-center rounded-lg content-start flex gap-x-1 py-2 w-full  hover:bg-hover-lightish cursor-pointer`}
                    onClick={() => {
                      updatedTaggedAssistant(currentAssistant);
                    }}
                  >
                    <OnyxIcon
                      // assistant={currentAssistant}
                      size={16}
                      className="my-auto text-text-400"
                    />
                    <p className="font-bold">{currentAssistant.name}</p>
                    <p className="line-clamp-1">
                      {currentAssistant.id == selectedAssistant.id &&
                        "(default) "}
                      {currentAssistant.description}
                    </p>
                  </button>
                ))}

                <a
                  key={assistantTagOptions.length}
                  target="_self"
                  className={`${
                    tabbingIconIndex == assistantTagOptions.length && "bg-hover"
                  } rounded rounded-lg px-3 flex gap-x-1 py-2 w-full  items-center  hover:bg-hover-lightish cursor-pointer"`}
                  href="/assistants/new"
                >
                  <FiPlus size={17} />
                  <p>Create a new assistant</p>
                </a>
              </div>
            </div>
          )}

          <UnconfiguredProviderText showConfigureAPIKey={showConfigureAPIKey} />

          <div
            className="
              opacity-100
              w-full
              h-fit
              flex
              flex-col
              border
              border-[#E5E7EB]
              rounded-lg
              text-text-chatbar
              [&:has(textarea:focus)]::ring-1
              [&:has(textarea:focus)]::ring-black
            "
          >
            {alternativeAssistant && (
              <div className="flex flex-wrap gap-x-2 px-2 pt-1.5 w-full">
                <div
                  ref={interactionsRef}
                  className="p-2 rounded-t-lg items-center flex w-full"
                >
                  <AssistantIcon assistant={alternativeAssistant} />
                  <p className="ml-3 text-strong my-auto">
                    {alternativeAssistant.name}
                  </p>
                  <div className="flex gap-x-1 ml-auto">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button>
                            <Hoverable icon={FiInfo} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs flex flex-wrap">
                            {alternativeAssistant.description}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Hoverable
                      icon={FiX}
                      onClick={() => setAlternativeAssistant(null)}
                    />
                  </div>
                </div>
              </div>
            )}

            <textarea
              onPaste={handlePaste}
              onKeyDownCapture={handleKeyDown}
              onChange={handleInputChange}
              ref={textAreaRef}
              className={`
                m-0
                w-full
                shrink
                resize-none
                rounded-lg
                border-0
                bg-[#FEFCFA]
                placeholder:text-text-chatbar-subtle
                ${
                  textAreaRef.current &&
                  textAreaRef.current.scrollHeight > MAX_INPUT_HEIGHT
                    ? "overflow-y-auto mt-2"
                    : ""
                }
                whitespace-normal
                break-word
                overscroll-contain
                outline-none
                placeholder-subtle
                resize-none
                px-5
                py-4
              `}
              autoFocus
              style={{ scrollbarWidth: "thin" }}
              role="textarea"
              aria-multiline
              placeholder="Ask me anything..."
              value={message}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !showSuggestions &&
                  !event.shiftKey &&
                  !(event.nativeEvent as any).isComposing
                ) {
                  event.preventDefault();
                  if (message) {
                    onSubmit();
                  }
                }
              }}
              suppressContentEditableWarning={true}
            />

            {(selectedDocuments.length > 0 ||
              files.length > 0 ||
              filterManager.selectedSources.length > 0) && (
              <div className="flex gap-x-.5 px-2">
                <div className="flex gap-x-1 px-2 overflow-visible overflow-x-scroll items-end miniscroll">
                  {filterManager.selectedSources.length > 0 &&
                    filterManager.selectedSources.map((source) => (
                      <div className="flex-none" key={source.internalName}>
                        <SourceChip
                          source={source}
                          onRemove={() => {
                            filterManager.setSelectedSources(
                              filterManager.selectedSources.filter(
                                (s) => s.internalName !== source.internalName
                              )
                            );
                          }}
                        />
                      </div>
                    ))}

                  {selectedDocuments.length > 0 && (
                    <button
                      onClick={showDocs}
                      className="flex-none relative overflow-visible flex items-center gap-x-2 h-10 px-3 rounded-lg bg-background-150 hover:bg-background-200 transition-colors duration-300 cursor-pointer max-w-[150px]"
                    >
                      <FileIcon size={20} />
                      <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                        {selectedDocuments.length} selected
                      </span>
                      <XIcon
                        onClick={removeDocs}
                        size={16}
                        className="text-text-400 hover:text-text-600 ml-auto"
                      />
                    </button>
                  )}

                  {files.map((file) => (
                    <div className="flex-none" key={file.id}>
                      {file.type === ChatFileType.IMAGE ? (
                        <InputBarPreviewImageProvider
                          file={file}
                          onDelete={() => {
                            setFiles(
                              files.filter(
                                (fileInFilter) => fileInFilter.id !== file.id
                              )
                            );
                          }}
                          isUploading={file.isUploading || false}
                        />
                      ) : (
                        <InputBarPreview
                          file={file}
                          onDelete={() => {
                            setFiles(
                              files.filter(
                                (fileInFilter) => fileInFilter.id !== file.id
                              )
                            );
                          }}
                          isUploading={file.isUploading || false}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-1 mr-12 px-4 pb-2">
              <ChatInputOption
                flexPriority="stiff"
                name="File"
                Icon={FiPlusCircle}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.multiple = true; // Allow multiple files
                  input.onchange = (event: any) => {
                    const files = Array.from(
                      event?.target?.files || []
                    ) as File[];
                    if (files.length > 0) {
                      handleFileUpload(files);
                    }
                  };
                  input.click();
                }}
                tooltipContent={"Upload files"}
              />

              <FilterPopup
                availableSources={availableSources}
                availableDocumentSets={availableDocumentSets}
                availableTags={availableTags}
                filterManager={filterManager}
                trigger={
                  <ChatInputOption
                    flexPriority="stiff"
                    name="Filters"
                    Icon={FiFilter}
                    tooltipContent="Filter your search"
                  />
                }
              />

              <ChatInputOption
                toggle
                flexPriority="stiff"
                name="Models"
                Icon={AnthropicSVG}
                onClick={() => {}}
                tooltipContent={"Switch models"}
              />
            </div>

            <div className="absolute bottom-2.5 mobile:right-4 desktop:right-10">
              {chatState == "streaming" ||
              chatState == "toolBuilding" ||
              chatState == "loading" ? (
                <button
                  className={`cursor-pointer ${
                    chatState != "streaming"
                      ? "bg-background-400"
                      : "bg-background-800"
                  }  h-[28px] w-[28px] rounded-full`}
                  onClick={stopGenerating}
                  disabled={chatState != "streaming"}
                >
                  <StopGeneratingIcon
                    size={10}
                    className={`text-emphasis m-auto text-white flex-none
                      }`}
                  />
                </button>
              ) : (
                <button
                  className="cursor-pointer"
                  onClick={() => {
                    if (message) {
                      onSubmit();
                    }
                  }}
                  disabled={chatState != "input"}
                >
                  <SendIcon
                    size={26}
                    className={`text-emphasis text-white p-1 rounded-lg  ${
                      chatState == "input" && message
                        ? "bg-submit-background"
                        : "bg-disabled-submit-background"
                    } `}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
