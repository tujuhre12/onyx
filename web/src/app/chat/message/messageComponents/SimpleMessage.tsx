import {
  Packet,
  MessageStart,
  MessageDelta,
  PacketType,
} from "../../services/streamingModels";
import { FullChatState } from "./interfaces";
import { renderMessageComponent } from "./renderMessageComponent";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { CopyButton } from "@/components/CopyButton";
import { LikeFeedback, DislikeFeedback } from "@/components/icons/icons";
import { HoverableIcon } from "@/components/Hoverable";
import {
  CustomTooltip,
  TooltipGroup,
} from "@/components/tooltip/CustomTooltip";
import { useRef, useState } from "react";
import { copyAll, handleCopy } from "../copyingUtils";
import RegenerateOption from "../../components/RegenerateOption";
import { MessageSwitcher } from "../MessageSwitcher";
import { BlinkingDot } from "../BlinkingDot";
import { STANDARD_TEXT_COLOR } from "./constants";

// Multi-tool renderer component for grouped tools
function MultiToolRenderer({
  packets,
  chatState,
}: {
  packets: Packet[];
  chatState: FullChatState;
}) {
  // Group packets by tool instance (consecutive tool start/delta/end sequences)
  const toolGroups: Packet[][] = [];
  let currentGroup: Packet[] = [];

  for (const packet of packets) {
    if (packet.obj.type === PacketType.TOOL_START) {
      // Start a new group
      if (currentGroup.length > 0) {
        toolGroups.push(currentGroup);
      }
      currentGroup = [packet];
    } else {
      // Add to current group
      currentGroup.push(packet);
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    toolGroups.push(currentGroup);
  }

  // Previously we computed summary details for a header that has been removed

  return (
    <div className="mb-4 relative border border-border-sidebar-border rounded-lg p-4">
      <div className="relative">
        {/* Tool items */}
        <div>
          {toolGroups.map((toolGroup, index) => {
            const [icon, content] = renderMessageComponent(
              { packets: toolGroup },
              chatState
            );

            const finalIcon = icon ? icon({ size: 14 }) : null;
            const isLastItem = index === toolGroups.length - 1;

            return (
              <div key={index} className="relative">
                {/* Connector line drawn BEFORE content so it's behind everything */}
                {!isLastItem && (
                  <div
                    className="absolute w-px bg-gray-300 dark:bg-gray-600 z-0"
                    style={{
                      left: "10px", // Half of icon width (20px / 2)
                      top: "20px", // Below icon (h-5 = 20px)
                      bottom: "0", // Stop at the bottom of this container, not beyond
                    }}
                  />
                )}

                {/* Main row with icon and content */}
                <div
                  className={`flex items-start gap-2 ${STANDARD_TEXT_COLOR} relative z-10`}
                >
                  {/* Icon column */}
                  <div className="flex flex-col items-center w-5">
                    {/* Icon with background to cover the line */}
                    <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-background rounded-full">
                      {finalIcon}
                    </div>
                  </div>

                  {/* Content with padding */}
                  <div className={`flex-1 ${!isLastItem ? "pb-3" : ""}`}>
                    {content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function SimpleMessage({
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

  // Calculate message switching state
  const currentMessageInd = messageId
    ? otherMessagesCanSwitchTo?.indexOf(messageId)
    : undefined;

  const includeMessageSwitcher =
    currentMessageInd !== undefined &&
    onMessageSelection &&
    otherMessagesCanSwitchTo &&
    otherMessagesCanSwitchTo.length > 1;

  const getPreviousMessage = () => {
    if (
      currentMessageInd !== undefined &&
      currentMessageInd > 0 &&
      otherMessagesCanSwitchTo
    ) {
      return otherMessagesCanSwitchTo[currentMessageInd - 1];
    }
    return undefined;
  };

  const getNextMessage = () => {
    if (
      currentMessageInd !== undefined &&
      currentMessageInd < (otherMessagesCanSwitchTo?.length || 0) - 1 &&
      otherMessagesCanSwitchTo
    ) {
      return otherMessagesCanSwitchTo[currentMessageInd + 1];
    }
    return undefined;
  };

  // Group all chat packets together by ind
  const groupedChatPacketsByInd: Map<number, Packet[]> = rawPackets.reduce(
    (acc: Map<number, Packet[]>, packet) => {
      const ind = packet.ind;
      if (!acc.has(ind)) {
        acc.set(ind, []);
      }
      acc.get(ind)!.push(packet);
      return acc;
    },
    new Map()
  );

  // Helper function to check if packets are tool packets
  const isToolGroup = (packets: Packet[]) => {
    return packets.some(
      (packet) =>
        packet.obj.type === PacketType.TOOL_START ||
        packet.obj.type === PacketType.TOOL_DELTA ||
        packet.obj.type === PacketType.TOOL_END
    );
  };

  // Create smart groups that combine consecutive tool groups
  const createSmartGroups = () => {
    const sortedEntries = Array.from(groupedChatPacketsByInd.entries()).sort(
      ([a], [b]) => a - b
    );
    console.log("sortedEntries", sortedEntries);
    const smartGroups: {
      packets: Packet[];
      isToolGroup: boolean;
      inds: number[];
    }[] = [];
    let currentToolGroup: { packets: Packet[]; inds: number[] } | null = null;

    for (const [ind, packets] of sortedEntries) {
      const isThisGroupTools = isToolGroup(packets);

      if (isThisGroupTools) {
        if (currentToolGroup) {
          // Add to existing tool group
          currentToolGroup.packets.push(...packets);
          currentToolGroup.inds.push(ind);
        } else {
          // Start new tool group
          currentToolGroup = { packets: [...packets], inds: [ind] };
        }
      } else {
        // Non-tool group - finalize any pending tool group first
        if (currentToolGroup) {
          smartGroups.push({
            packets: currentToolGroup.packets,
            isToolGroup: true,
            inds: currentToolGroup.inds,
          });
          currentToolGroup = null;
        }
        // Add the non-tool group
        smartGroups.push({
          packets,
          isToolGroup: false,
          inds: [ind],
        });
      }
    }

    // Don't forget any pending tool group
    if (currentToolGroup) {
      smartGroups.push({
        packets: currentToolGroup.packets,
        isToolGroup: true,
        inds: currentToolGroup.inds,
      });
    }

    return smartGroups;
  };

  const smartGroups = createSmartGroups();
  console.log("smartGroups", smartGroups);

  // Check if streaming is complete (has STOP packet)
  const isStreamingComplete = rawPackets.some(
    (packet) => packet.obj.type === PacketType.STOP
  );

  // Extract text content for copying
  const getTextContent = () => {
    return smartGroups
      .map((group) => {
        // Extract text from packets - this is a simplified approach
        return group.packets
          .map((packet) => {
            if (
              packet.obj.type === PacketType.MESSAGE_START ||
              packet.obj.type === PacketType.MESSAGE_DELTA
            ) {
              return (packet.obj as MessageStart | MessageDelta).content || "";
            }
            return "";
          })
          .join("")
          .trim();
      })
      .join("\n")
      .trim();
  };

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
                      {smartGroups.length === 0 && !isStreamingComplete ? (
                        // Show blinking dot when no content yet but message is generating
                        <BlinkingDot />
                      ) : (
                        smartGroups.map((group, index) => {
                          if (group.isToolGroup) {
                            return (
                              <div key={group.inds.join("-")}>
                                <MultiToolRenderer
                                  packets={group.packets}
                                  chatState={chatState}
                                />
                              </div>
                            );
                          } else {
                            const [_, content] = renderMessageComponent(
                              { packets: group.packets },
                              chatState
                            );
                            return (
                              <div key={group.inds.join("-")}>{content}</div>
                            );
                          }
                        })
                      )}
                    </div>
                  </div>

                  {/* Feedback buttons - only show when streaming is complete */}
                  {chatState.handleFeedback && isStreamingComplete && (
                    <div className="flex md:flex-row gap-x-0.5 mt-1 transition-transform duration-300 ease-in-out transform opacity-100">
                      <TooltipGroup>
                        <div className="flex justify-start w-full gap-x-0.5">
                          {includeMessageSwitcher && (
                            <div className="-mx-1 mr-auto">
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
                        </div>
                        <CustomTooltip showTick line content="Copy">
                          <CopyButton
                            copyAllFn={() =>
                              copyAll(getTextContent(), markdownRef)
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
                            onClick={() => chatState.handleFeedback("dislike")}
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
