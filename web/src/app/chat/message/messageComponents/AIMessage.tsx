import {
  Packet,
  PacketType,
  CitationDelta,
  SearchToolDelta,
  ImageGenerationToolDelta,
  StreamingCitation,
} from "../../services/streamingModels";
import { FullChatState } from "./interfaces";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { CopyButton } from "@/components/CopyButton";
import { LikeFeedback, DislikeFeedback } from "@/components/icons/icons";
import { HoverableIcon } from "@/components/Hoverable";
import { OnyxDocument } from "@/lib/search/interfaces";
import { CitedSourcesToggle } from "./CitedSourcesToggle";
import {
  CustomTooltip,
  TooltipGroup,
} from "@/components/tooltip/CustomTooltip";
import { useMemo, useRef, useState } from "react";
import {
  useChatSessionStore,
  useDocumentSidebarVisible,
  useSelectedMessageForDocDisplay,
} from "../../stores/useChatSessionStore";
import { copyAll, handleCopy } from "../copyingUtils";
import RegenerateOption from "../../components/RegenerateOption";
import { MessageSwitcher } from "../MessageSwitcher";
import { BlinkingDot } from "../BlinkingDot";
import {
  getTextContent,
  groupPacketsByInd,
  isFinalAnswerComing,
  isStreamingComplete,
  isToolPacket,
} from "./packetUtils";
import { useMessageSwitching } from "./hooks/useMessageSwitching";
import MultiToolRenderer, { RendererComponent } from "./MultiToolRenderer";

export function AIMessage({
  rawPackets,
  chatState,
  messageId,
  otherMessagesCanSwitchTo,
  onMessageSelection,
}: {
  rawPackets: Packet[];
  chatState: FullChatState;
  messageId?: number | null;
  otherMessagesCanSwitchTo?: number[];
  onMessageSelection?: (messageId: number) => void;
}) {
  const markdownRef = useRef<HTMLDivElement>(null);
  const [isRegenerateDropdownVisible, setIsRegenerateDropdownVisible] =
    useState(false);

  const [allToolsFullyDisplayed, setAllToolsFullyDisplayed] = useState(
    isFinalAnswerComing(rawPackets) || isStreamingComplete(rawPackets)
  );

  const [displayComplete, setDisplayComplete] = useState(
    isStreamingComplete(rawPackets)
  );

  // Extract citations from packets
  const citations = useMemo(() => {
    const extractedCitations: StreamingCitation[] = [];
    const seenDocumentIds = new Set<string>();

    const citationPackets = rawPackets.filter(
      (packet) =>
        packet.obj.type === PacketType.CITATION_START ||
        packet.obj.type === PacketType.CITATION_DELTA ||
        packet.obj.type === PacketType.CITATION_END
    );

    console.log("citationPackets", citationPackets);

    for (const packet of citationPackets) {
      if (packet.obj.type === PacketType.CITATION_DELTA) {
        const citationDelta = packet.obj as CitationDelta;
        if (citationDelta.citations) {
          for (const citation of citationDelta.citations) {
            if (!seenDocumentIds.has(citation.document_id)) {
              seenDocumentIds.add(citation.document_id);
              extractedCitations.push(citation);
            }
          }
        }
      }
    }

    return extractedCitations;
  }, [rawPackets.length]);

  // Extract documents from tool packets
  const documentMap = useMemo(() => {
    const docMap = new Map<string, OnyxDocument>();

    const toolPackets = rawPackets.filter(
      (packet) =>
        packet.obj.type === PacketType.SEARCH_TOOL_DELTA ||
        packet.obj.type === PacketType.IMAGE_GENERATION_TOOL_DELTA
    );

    for (const packet of toolPackets) {
      const toolDelta = packet.obj as
        | SearchToolDelta
        | ImageGenerationToolDelta;
      if ("documents" in toolDelta && toolDelta.documents) {
        for (const doc of toolDelta.documents) {
          if (doc.document_id) {
            docMap.set(doc.document_id, doc);
          }
        }
      }
    }

    return docMap;
  }, [rawPackets.length]);

  console.log("documentMap", documentMap);
  console.log("citations", citations);

  // Use store for document sidebar
  const documentSidebarVisible = useDocumentSidebarVisible();
  const selectedMessageForDocDisplay = useSelectedMessageForDocDisplay();
  const updateCurrentDocumentSidebarVisible = useChatSessionStore(
    (state) => state.updateCurrentDocumentSidebarVisible
  );
  const updateCurrentSelectedMessageForDocDisplay = useChatSessionStore(
    (state) => state.updateCurrentSelectedMessageForDocDisplay
  );

  // Calculate unique source count
  const uniqueSourceCount = useMemo(() => {
    const uniqueDocIds = new Set<string>();

    // Add document IDs from citations
    citations.forEach((citation) => {
      if (citation.document_id) {
        uniqueDocIds.add(citation.document_id);
      }
    });

    // Add document IDs from documentMap
    documentMap.forEach((_, docId) => {
      uniqueDocIds.add(docId);
    });

    return uniqueDocIds.size;
  }, [citations, documentMap]);

  // Message switching logic
  const {
    currentMessageInd,
    includeMessageSwitcher,
    getPreviousMessage,
    getNextMessage,
  } = useMessageSwitching({
    messageId,
    otherMessagesCanSwitchTo,
    onMessageSelection,
  });

  const groupedPackets = useMemo(() => {
    return groupPacketsByInd(rawPackets);
  }, [rawPackets.length]);

  // Return a list of rendered message components, one for each ind
  return (
    <div className="py-5 ml-4 lg:px-5 relative flex">
      <div className="mx-auto w-[90%] max-w-message-max">
        <div className="lg:mr-12 mobile:ml-0 md:ml-8">
          <div className="flex items-start">
            <AssistantIcon
              className="mobile:hidden"
              size={24}
              assistant={chatState.assistant}
            />
            <div className="w-full">
              <div className="max-w-message-max break-words">
                <div className="w-full desktop:ml-4">
                  <div className="max-w-message-max break-words">
                    <div
                      ref={markdownRef}
                      className="overflow-x-visible max-w-content-max focus:outline-none cursor-text select-text"
                      onCopy={(e) => handleCopy(e, markdownRef)}
                    >
                      {groupedPackets.length === 0 ? (
                        // Show blinking dot when no content yet but message is generating
                        <BlinkingDot />
                      ) : (
                        (() => {
                          // Separate tool groups from final answer groups
                          const toolGroups = groupedPackets.filter(
                            (group) =>
                              group.packets[0] && isToolPacket(group.packets[0])
                          ) as { ind: number; packets: Packet[] }[];
                          // display final answer only if all tools are fully displayed
                          // OR if there are no tools at all (in which case show immediately)
                          const finalAnswerGroups =
                            allToolsFullyDisplayed || toolGroups.length === 0
                              ? groupedPackets.filter(
                                  (group) =>
                                    group.packets[0] &&
                                    !isToolPacket(group.packets[0])
                                )
                              : [];

                          return (
                            <>
                              {/* Render all tool groups together using MultiToolRenderer */}
                              {toolGroups.length > 0 && (
                                <MultiToolRenderer
                                  packetGroups={toolGroups}
                                  chatState={chatState}
                                  isComplete={allToolsFullyDisplayed}
                                  onAllToolsDisplayed={() =>
                                    setAllToolsFullyDisplayed(true)
                                  }
                                />
                              )}

                              {/* Render final answer groups directly using renderMessageComponent */}
                              {finalAnswerGroups.map((group) => (
                                <RendererComponent
                                  key={group.ind}
                                  packets={group.packets}
                                  chatState={chatState}
                                  onComplete={() => {
                                    // Final answer completed
                                    setDisplayComplete(true);
                                  }}
                                  animate={!displayComplete}
                                >
                                  {({ content }) => <div>{content}</div>}
                                </RendererComponent>
                              ))}
                            </>
                          );
                        })()
                      )}
                    </div>
                  </div>

                  {/* Feedback buttons - only show when streaming is complete */}
                  {chatState.handleFeedback && displayComplete && (
                    <div className="flex md:flex-row justify-between items-center w-full mt-1 transition-transform duration-300 ease-in-out transform opacity-100">
                      <TooltipGroup>
                        <div className="flex items-center gap-x-0.5">
                          {includeMessageSwitcher && (
                            <div className="-mx-1">
                              <MessageSwitcher
                                currentPage={(currentMessageInd ?? 0) + 1}
                                totalPages={
                                  otherMessagesCanSwitchTo?.length || 0
                                }
                                handlePrevious={() => {
                                  const prevMessage = getPreviousMessage();
                                  if (
                                    prevMessage !== undefined &&
                                    onMessageSelection
                                  ) {
                                    onMessageSelection(prevMessage);
                                  }
                                }}
                                handleNext={() => {
                                  const nextMessage = getNextMessage();
                                  if (
                                    nextMessage !== undefined &&
                                    onMessageSelection
                                  ) {
                                    onMessageSelection(nextMessage);
                                  }
                                }}
                              />
                            </div>
                          )}

                          <CustomTooltip showTick line content="Copy">
                            <CopyButton
                              copyAllFn={() =>
                                copyAll(getTextContent(rawPackets), markdownRef)
                              }
                            />
                          </CustomTooltip>

                          <CustomTooltip showTick line content="Good response">
                            <HoverableIcon
                              icon={<LikeFeedback size={16} />}
                              onClick={() => chatState.handleFeedback("like")}
                            />
                          </CustomTooltip>

                          <CustomTooltip showTick line content="Bad response">
                            <HoverableIcon
                              icon={<DislikeFeedback size={16} />}
                              onClick={() =>
                                chatState.handleFeedback("dislike")
                              }
                            />
                          </CustomTooltip>

                          {chatState.regenerate && (
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
                                selectedAssistant={chatState.assistant}
                                regenerate={chatState.regenerate}
                                overriddenModel={chatState.overriddenModel}
                              />
                            </CustomTooltip>
                          )}

                          {messageId &&
                            (citations.length > 0 || documentMap.size > 0) && (
                              <>
                                {chatState.regenerate && (
                                  <div className="h-4 w-px bg-border mx-2" />
                                )}
                                <CustomTooltip
                                  showTick
                                  line
                                  content={`${uniqueSourceCount} Sources`}
                                >
                                  <CitedSourcesToggle
                                    citations={citations}
                                    documentMap={documentMap}
                                    messageId={messageId}
                                    onToggle={(messageId) => {
                                      // Toggle sidebar if clicking on the same message
                                      if (
                                        selectedMessageForDocDisplay ===
                                          messageId &&
                                        documentSidebarVisible
                                      ) {
                                        updateCurrentDocumentSidebarVisible(
                                          false
                                        );
                                        updateCurrentSelectedMessageForDocDisplay(
                                          null
                                        );
                                      } else {
                                        updateCurrentSelectedMessageForDocDisplay(
                                          messageId
                                        );
                                        updateCurrentDocumentSidebarVisible(
                                          true
                                        );
                                      }
                                    }}
                                  />
                                </CustomTooltip>
                              </>
                            )}
                        </div>
                      </TooltipGroup>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
