"use client";

import {
  FiEdit2,
  FiChevronRight,
  FiChevronLeft,
  FiTool,
  FiGlobe,
} from "react-icons/fi";
import { FeedbackType } from "../types";
import React, {
  memo,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { OnyxDocument, FilteredOnyxDocument } from "@/lib/search/interfaces";
import { SearchSummary } from "./SearchSummary";

import { SkippedSearch } from "./SkippedSearch";
import remarkGfm from "remark-gfm";
import { CopyButton } from "@/components/CopyButton";
import {
  ChatFileType,
  FileDescriptor,
  SubQuestionDetail,
  ToolCallMetadata,
} from "../interfaces";
import {
  IMAGE_GENERATION_TOOL_NAME,
  SEARCH_TOOL_NAME,
  INTERNET_SEARCH_TOOL_NAME,
} from "../tools/constants";
import { ToolRunDisplay } from "../tools/ToolRunningAnimation";
import { Hoverable, HoverableIcon } from "@/components/Hoverable";
import { DocumentPreview } from "../files/documents/DocumentPreview";
import { InMessageImage } from "../files/images/InMessageImage";
import { CodeBlock } from "./CodeBlock";
import rehypePrism from "rehype-prism-plus";

import "prismjs/themes/prism-tomorrow.css";
import "./custom-code-styles.css";
import { Persona } from "@/app/admin/assistants/interfaces";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";

import { LikeFeedback, DislikeFeedback } from "@/components/icons/icons";
import {
  CustomTooltip,
  TooltipGroup,
} from "@/components/tooltip/CustomTooltip";
import { ValidSources } from "@/lib/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMouseTracking } from "./hooks";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import GeneratingImageDisplay from "../tools/GeneratingImageDisplay";
import RegenerateOption from "../RegenerateOption";
import { LlmOverride } from "@/lib/hooks";
import { ContinueGenerating } from "./ContinueMessage";
import { MemoizedAnchor, MemoizedParagraph } from "./MemoizedTextComponents";
import { extractCodeText, preprocessLaTeX } from "./codeUtils";
import ToolResult from "../../../components/tools/ToolResult";
import CsvContent from "../../../components/tools/CSVContent";
import SourceCard, {
  SeeMoreBlock,
} from "@/components/chat_search/sources/SourceCard";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import FiltersDisplay from "../input/FilterDisplay";
import SubQuestionsDisplay from "./SubQuestionsDisplay";
import DocumentsDisplay from "./DocumentsDisplay";

const TOOLS_WITH_CUSTOM_HANDLING = [
  SEARCH_TOOL_NAME,
  INTERNET_SEARCH_TOOL_NAME,
  IMAGE_GENERATION_TOOL_NAME,
];

export const AgenticMessage = ({
  regenerate,
  overriddenModel,
  selectedMessageForDocDisplay,
  continueGenerating,
  shared,
  isActive,
  toggleDocumentSelection,
  alternativeAssistant,
  docs,
  messageId,
  documentSelectionToggled,
  content,
  files,
  selectedDocuments,
  query,
  citedDocuments,
  toolCall,
  isComplete,
  hasDocs,
  handleFeedback,
  handleShowRetrieved,
  handleSearchQueryEdit,
  handleForceSearch,
  retrievalDisabled,
  currentPersona,
  otherMessagesCanSwitchTo,
  onMessageSelection,
  setPresentingDocument,
  index,
  subQuestions,
}: {
  subQuestions: SubQuestionDetail[] | null;
  index?: number;
  selectedMessageForDocDisplay?: number | null;
  shared?: boolean;
  isActive?: boolean;
  continueGenerating?: () => void;
  otherMessagesCanSwitchTo?: number[];
  onMessageSelection?: (messageId: number) => void;
  selectedDocuments?: OnyxDocument[] | null;
  toggleDocumentSelection?: () => void;
  docs?: OnyxDocument[] | null;
  alternativeAssistant?: Persona | null;
  currentPersona: Persona;
  messageId: number | null;
  content: string | JSX.Element;
  documentSelectionToggled?: boolean;
  files?: FileDescriptor[];
  query?: string;
  citedDocuments?: [string, OnyxDocument][] | null;
  toolCall?: ToolCallMetadata | null;
  isComplete?: boolean;
  hasDocs?: boolean;
  handleFeedback?: (feedbackType: FeedbackType) => void;
  handleShowRetrieved?: (messageNumber: number | null) => void;
  handleSearchQueryEdit?: (query: string) => void;
  handleForceSearch?: () => void;
  retrievalDisabled?: boolean;
  overriddenModel?: string;
  regenerate?: (modelOverRide: LlmOverride) => Promise<void>;
  setPresentingDocument?: (document: OnyxDocument) => void;
}) => {
  const toolCallGenerating = toolCall && !toolCall.tool_result;

  const processContent = (content: string | JSX.Element) => {
    if (typeof content !== "string") {
      return content;
    }

    const codeBlockRegex = /```(\w*)\n[\s\S]*?```|```[\s\S]*?$/g;
    const matches = content.match(codeBlockRegex);

    if (matches) {
      content = matches.reduce((acc, match) => {
        if (!match.match(/```\w+/)) {
          return acc.replace(match, match.replace("```", "```plaintext"));
        }
        return acc;
      }, content);

      const lastMatch = matches[matches.length - 1];
      if (!lastMatch.endsWith("```")) {
        return preprocessLaTeX(content);
      }
    }

    return (
      preprocessLaTeX(content) +
      (!isComplete && !toolCallGenerating ? " [*]() " : "")
    );
  };

  const finalContent = processContent(content as string);

  const [isRegenerateHovered, setIsRegenerateHovered] = useState(false);
  const [isRegenerateDropdownVisible, setIsRegenerateDropdownVisible] =
    useState(false);
  const { isHovering, trackedElementRef, hoverElementRef } = useMouseTracking();

  const settings = useContext(SettingsContext);
  // this is needed to give Prism a chance to load

  const selectedDocumentIds =
    selectedDocuments?.map((document) => document.document_id) || [];
  const citedDocumentIds: string[] = [];

  citedDocuments?.forEach((doc) => {
    citedDocumentIds.push(doc[1].document_id);
  });

  if (!isComplete) {
    const trimIncompleteCodeSection = (
      content: string | JSX.Element
    ): string | JSX.Element => {
      if (typeof content === "string") {
        const pattern = /```[a-zA-Z]+[^\s]*$/;
        const match = content.match(pattern);
        if (match && match.index && match.index > 3) {
          const newContent = content.slice(0, match.index - 3);
          return newContent;
        }
        return content;
      }
      return content;
    };
    content = trimIncompleteCodeSection(content);
  }

  let filteredDocs: FilteredOnyxDocument[] = [];

  if (docs) {
    filteredDocs = docs
      .filter(
        (doc, index, self) =>
          doc.document_id &&
          doc.document_id !== "" &&
          index === self.findIndex((d) => d.document_id === doc.document_id)
      )
      .filter((doc) => {
        return citedDocumentIds.includes(doc.document_id);
      })
      .map((doc: OnyxDocument, ind: number) => {
        return {
          ...doc,
          included: selectedDocumentIds.includes(doc.document_id),
        };
      });
  }

  const paragraphCallback = useCallback(
    (props: any) => <MemoizedParagraph>{props.children}</MemoizedParagraph>,
    []
  );

  const anchorCallback = useCallback(
    (props: any) => (
      <MemoizedAnchor
        updatePresentingDocument={setPresentingDocument!}
        docs={docs}
      >
        {props.children}
      </MemoizedAnchor>
    ),
    [docs]
  );

  const currentMessageInd = messageId
    ? otherMessagesCanSwitchTo?.indexOf(messageId)
    : undefined;

  const uniqueSources: ValidSources[] = Array.from(
    new Set((docs || []).map((doc) => doc.source_type))
  ).slice(0, 3);

  const markdownComponents = useMemo(
    () => ({
      a: anchorCallback,
      p: paragraphCallback,
      code: ({ node, className, children }: any) => {
        const codeText = extractCodeText(
          node,
          finalContent as string,
          children
        );

        return (
          <CodeBlock className={className} codeText={codeText}>
            {children}
          </CodeBlock>
        );
      },
    }),
    [anchorCallback, paragraphCallback, finalContent]
  );

  const renderedMarkdown = useMemo(() => {
    return (
      <ReactMarkdown
        className="prose max-w-full text-base"
        components={markdownComponents}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypePrism, { ignoreMissing: true }], rehypeKatex]}
      >
        {finalContent as string}
      </ReactMarkdown>
    );
  }, [finalContent, markdownComponents]);

  const includeMessageSwitcher =
    currentMessageInd !== undefined &&
    onMessageSelection &&
    otherMessagesCanSwitchTo &&
    otherMessagesCanSwitchTo.length > 1;

  return (
    <div
      id="onyx-ai-message"
      ref={trackedElementRef}
      className={`py-5 ml-4 lg:px-5 relative flex `}
    >
      <div
        className={`mx-auto ${
          shared ? "w-full" : "w-[90%]"
        }  max-w-message-max`}
      >
        <div className={`lg:mr-12 ${!shared && "mobile:ml-0 md:ml-8"}`}>
          <div className="flex">
            <AssistantIcon
              className="mobile:hidden"
              size={24}
              assistant={alternativeAssistant || currentPersona}
            />

            <div className="w-full">
              <div className="max-w-message-max break-words">
                <div className="w-full desktop:ml-4">
                  <div className="max-w-message-max break-words">
                    {!toolCall || toolCall.tool_name === SEARCH_TOOL_NAME ? (
                      <>
                        {query !== undefined && !retrievalDisabled && (
                          <div className="mb-1">
                            <SearchSummary
                              index={index || 0}
                              query={query}
                              finished={toolCall?.tool_result != undefined}
                              handleSearchQueryEdit={handleSearchQueryEdit}
                              docs={docs || []}
                              toggleDocumentSelection={toggleDocumentSelection!}
                            />
                          </div>
                        )}
                        {handleForceSearch &&
                          content &&
                          query === undefined &&
                          !hasDocs &&
                          !retrievalDisabled && (
                            <div className="mb-1">
                              <SkippedSearch
                                handleForceSearch={handleForceSearch}
                              />
                            </div>
                          )}
                      </>
                    ) : null}

                    {toolCall &&
                      !TOOLS_WITH_CUSTOM_HANDLING.includes(
                        toolCall.tool_name
                      ) && (
                        <ToolRunDisplay
                          toolName={
                            toolCall.tool_result && content
                              ? `Used "${toolCall.tool_name}"`
                              : `Using "${toolCall.tool_name}"`
                          }
                          toolLogo={
                            <FiTool size={15} className="my-auto mr-1" />
                          }
                          isRunning={!toolCall.tool_result || !content}
                        />
                      )}

                    {toolCall &&
                      (!files || files.length == 0) &&
                      toolCall.tool_name === IMAGE_GENERATION_TOOL_NAME &&
                      !toolCall.tool_result && <GeneratingImageDisplay />}

                    {toolCall &&
                      toolCall.tool_name === INTERNET_SEARCH_TOOL_NAME && (
                        <ToolRunDisplay
                          toolName={
                            toolCall.tool_result
                              ? `Searched the internet`
                              : `Searching the internet`
                          }
                          toolLogo={
                            <FiGlobe size={15} className="my-auto mr-1" />
                          }
                          isRunning={!toolCall.tool_result}
                        />
                      )}

                    {docs && docs.length > 0 && (
                      <div className="mobile:hidden mt-2 -mx-8 w-full mb-4 flex relative">
                        <div className="w-full">
                          <div className="px-8 flex gap-x-2">
                            {!settings?.isMobile &&
                              docs.length > 0 &&
                              docs
                                .slice(0, 2)
                                .map((doc, ind) => (
                                  <SourceCard
                                    doc={doc}
                                    key={ind}
                                    setPresentingDocument={
                                      setPresentingDocument
                                    }
                                  />
                                ))}
                            <SeeMoreBlock
                              documentSelectionToggled={
                                (documentSelectionToggled &&
                                  selectedMessageForDocDisplay === messageId) ||
                                false
                              }
                              toggleDocumentSelection={toggleDocumentSelection}
                              uniqueSources={uniqueSources}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {handleFeedback &&
                    (isActive ? (
                      <div
                        className={`
                          flex md:flex-row gap-x-0.5 mt-1
                          transition-transform duration-300 ease-in-out
                          transform opacity-100 translate-y-0"
                    `}
                      >
                        <TooltipGroup>
                          <div className="flex justify-start w-full gap-x-0.5">
                            {includeMessageSwitcher && (
                              <div className="-mx-1 mr-auto">
                                <MessageSwitcher
                                  currentPage={currentMessageInd + 1}
                                  totalPages={otherMessagesCanSwitchTo.length}
                                  handlePrevious={() => {
                                    onMessageSelection(
                                      otherMessagesCanSwitchTo[
                                        currentMessageInd - 1
                                      ]
                                    );
                                  }}
                                  handleNext={() => {
                                    onMessageSelection(
                                      otherMessagesCanSwitchTo[
                                        currentMessageInd + 1
                                      ]
                                    );
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <CustomTooltip showTick line content="Copy">
                            <CopyButton content={content.toString()} />
                          </CustomTooltip>
                          <CustomTooltip showTick line content="Good response">
                            <HoverableIcon
                              icon={<LikeFeedback />}
                              onClick={() => handleFeedback("like")}
                            />
                          </CustomTooltip>
                          <CustomTooltip showTick line content="Bad response">
                            <HoverableIcon
                              icon={<DislikeFeedback size={16} />}
                              onClick={() => handleFeedback("dislike")}
                            />
                          </CustomTooltip>
                          {regenerate && (
                            <CustomTooltip
                              disabled={isRegenerateDropdownVisible}
                              showTick
                              line
                              content="Regenerate"
                            >
                              <RegenerateOption
                                onDropdownVisibleChange={
                                  setIsRegenerateDropdownVisible
                                }
                                onHoverChange={setIsRegenerateHovered}
                                selectedAssistant={currentPersona!}
                                regenerate={regenerate}
                                overriddenModel={overriddenModel}
                              />
                            </CustomTooltip>
                          )}
                        </TooltipGroup>
                      </div>
                    ) : (
                      <div
                        ref={hoverElementRef}
                        className={`
                          absolute -bottom-5
                          z-10
                          invisible ${
                            (isHovering ||
                              isRegenerateHovered ||
                              settings?.isMobile) &&
                            "!visible"
                          }
                          opacity-0 ${
                            (isHovering ||
                              isRegenerateHovered ||
                              settings?.isMobile) &&
                            "!opacity-100"
                          }
                          translate-y-2 ${
                            (isHovering || settings?.isMobile) &&
                            "!translate-y-0"
                          }
                          transition-transform duration-300 ease-in-out 
                          flex md:flex-row gap-x-0.5 bg-background-125/40 -mx-1.5 p-1.5 rounded-lg
                          `}
                      >
                        <TooltipGroup>
                          <div className="flex justify-start w-full gap-x-0.5">
                            {includeMessageSwitcher && (
                              <div className="-mx-1 mr-auto">
                                <MessageSwitcher
                                  currentPage={currentMessageInd + 1}
                                  totalPages={otherMessagesCanSwitchTo.length}
                                  handlePrevious={() => {
                                    onMessageSelection(
                                      otherMessagesCanSwitchTo[
                                        currentMessageInd - 1
                                      ]
                                    );
                                  }}
                                  handleNext={() => {
                                    onMessageSelection(
                                      otherMessagesCanSwitchTo[
                                        currentMessageInd + 1
                                      ]
                                    );
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <CustomTooltip showTick line content="Copy">
                            <CopyButton content={content.toString()} />
                          </CustomTooltip>

                          <CustomTooltip showTick line content="Good response">
                            <HoverableIcon
                              icon={<LikeFeedback />}
                              onClick={() => handleFeedback("like")}
                            />
                          </CustomTooltip>

                          <CustomTooltip showTick line content="Bad response">
                            <HoverableIcon
                              icon={<DislikeFeedback size={16} />}
                              onClick={() => handleFeedback("dislike")}
                            />
                          </CustomTooltip>
                          {regenerate && (
                            <CustomTooltip
                              disabled={isRegenerateDropdownVisible}
                              showTick
                              line
                              content="Regenerate"
                            >
                              <RegenerateOption
                                selectedAssistant={currentPersona!}
                                onDropdownVisibleChange={
                                  setIsRegenerateDropdownVisible
                                }
                                regenerate={regenerate}
                                overriddenModel={overriddenModel}
                                onHoverChange={setIsRegenerateHovered}
                              />
                            </CustomTooltip>
                          )}
                        </TooltipGroup>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        {(!toolCall || toolCall.tool_name === SEARCH_TOOL_NAME) &&
          !query &&
          continueGenerating && (
            <ContinueGenerating handleContinueGenerating={continueGenerating} />
          )}
      </div>
      <div className="mt-4">
        {subQuestions && subQuestions.length > 0 && (
          <div className="mb-4">
            <SubQuestionsDisplay subQuestions={subQuestions} />
          </div>
        )}

        {docs && docs.length > 0 && (
          <div className="mt-4">
            <DocumentsDisplay documents={docs} />
          </div>
        )}
      </div>
    </div>
  );
};

function MessageSwitcher({
  currentPage,
  totalPages,
  handlePrevious,
  handleNext,
}: {
  currentPage: number;
  totalPages: number;
  handlePrevious: () => void;
  handleNext: () => void;
}) {
  return (
    <div className="flex items-center text-sm space-x-0.5">
      <Hoverable
        icon={FiChevronLeft}
        onClick={currentPage === 1 ? undefined : handlePrevious}
      />

      <span className="text-emphasis select-none">
        {currentPage} / {totalPages}
      </span>

      <Hoverable
        icon={FiChevronRight}
        onClick={currentPage === totalPages ? undefined : handleNext}
      />
    </div>
  );
}
