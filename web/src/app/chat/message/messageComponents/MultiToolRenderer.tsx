import { useState, useMemo, useEffect } from "react";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import { Packet } from "@/app/chat/services/streamingModels";
import { FullChatState, RendererResult } from "./interfaces";
import { renderMessageComponent } from "./renderMessageComponent";
import { isToolPacket } from "./packetUtils";
import { useToolDisplayTiming } from "./hooks/useToolDisplayTiming";
import { STANDARD_TEXT_COLOR } from "./constants";

// React component wrapper to avoid hook count issues in map loops
export function RendererComponent({
  packets,
  chatState,
  onComplete,
  animate,
  useShortRenderer = false,
  children,
}: {
  packets: Packet[];
  chatState: FullChatState;
  onComplete: () => void;
  animate: boolean;
  useShortRenderer?: boolean;
  children: (result: RendererResult) => JSX.Element;
}) {
  const result = renderMessageComponent(
    { packets },
    chatState,
    onComplete,
    animate,
    useShortRenderer
  );

  return children(result);
}

// Multi-tool renderer component for grouped tools
function MultiToolRenderer({
  packetGroups,
  chatState,
  isComplete,
  onAllToolsDisplayed,
}: {
  packetGroups: { ind: number; packets: Packet[] }[];
  chatState: FullChatState;
  isComplete: boolean;
  onAllToolsDisplayed?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toolGroups = useMemo(() => {
    return packetGroups.filter(
      (group) => group.packets[0] && isToolPacket(group.packets[0])
    );
  }, [packetGroups]);

  console.log("toolGroups", toolGroups);
  console.log("isComplete", isComplete);

  // Use the custom hook to manage tool display timing
  const { visibleTools, allToolsDisplayed, handleToolComplete } =
    useToolDisplayTiming(toolGroups, isComplete);

  // Notify parent when all tools are displayed
  useEffect(() => {
    if (allToolsDisplayed && onAllToolsDisplayed) {
      onAllToolsDisplayed();
    }
  }, [allToolsDisplayed, onAllToolsDisplayed]);

  // If still processing, show tools progressively with timing
  if (!isComplete) {
    // Get the tools to display based on visibleTools
    const toolsToDisplay = toolGroups.filter((group) =>
      visibleTools.has(group.ind)
    );

    if (toolsToDisplay.length === 0) {
      return null;
    }

    // Show only the latest tool visually, but render all for completion tracking
    const shouldShowOnlyLatest = !isExpanded && toolsToDisplay.length > 1;
    const latestToolIndex = toolsToDisplay.length - 1;

    return (
      <div className="mb-4 relative border border-border-sidebar-border rounded-lg p-4">
        <div className="relative">
          <div>
            {toolsToDisplay.map((toolGroup, index) => {
              if (!toolGroup) return null;

              // Hide all but the latest tool when shouldShowOnlyLatest is true
              const isVisible =
                !shouldShowOnlyLatest || index === latestToolIndex;
              const isLastItem = index === toolsToDisplay.length - 1;

              return (
                <div
                  key={index}
                  style={{ display: isVisible ? "block" : "none" }}
                >
                  <RendererComponent
                    packets={toolGroup.packets}
                    chatState={chatState}
                    onComplete={() => {
                      // When a tool completes rendering, track it in the hook
                      const toolInd = toolGroup.ind;
                      if (toolInd !== undefined) {
                        handleToolComplete(toolInd);
                      }
                    }}
                    animate
                    useShortRenderer={true}
                  >
                    {({ icon, content, status }) => {
                      return (
                        <div className="relative">
                          {/* Connector line for non-last items */}
                          {!isLastItem && isVisible && (
                            <div
                              className="absolute w-px bg-gray-300 dark:bg-gray-600 z-0"
                              style={{
                                left: "10px",
                                top: "24px",
                                bottom: "-12px",
                              }}
                            />
                          )}

                          <div className="text-sm flex items-center gap-1 loading-text">
                            {icon ? icon({ size: 14 }) : null}
                            {status}
                          </div>

                          <div
                            className={`${STANDARD_TEXT_COLOR} relative z-10 mt-1 ${
                              !isLastItem ? "mb-3" : ""
                            }`}
                          >
                            {content}
                          </div>
                        </div>
                      );
                    }}
                  </RendererComponent>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // If complete, show summary with toggle
  return (
    <div className="relative pb-1">
      {/* Summary header - clickable */}
      <div
        className="cursor-pointer transition-colors rounded-md p-1 -m-1"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Thought for 1m 21s
            </span>
          </div>
          <div className="text-gray-400 transition-transform duration-300 ease-in-out">
            {isExpanded ? (
              <FiChevronDown size={16} />
            ) : (
              <FiChevronRight size={16} />
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div
          className={`p-4 transition-transform duration-300 ease-in-out ${
            isExpanded ? "transform translate-y-0" : "transform -translate-y-2"
          }`}
        >
          <div>
            {toolGroups.map((toolGroup, index) => {
              const isLastItem = index === toolGroups.length - 1;

              return (
                <RendererComponent
                  key={index}
                  packets={toolGroup.packets}
                  chatState={chatState}
                  onComplete={() => {
                    // When a tool completes rendering, track it in the hook
                    const toolInd = toolGroup.ind;
                    if (toolInd !== undefined) {
                      handleToolComplete(toolInd);
                    }
                  }}
                  animate
                  useShortRenderer={false}
                >
                  {({ icon, content, status }) => {
                    const finalIcon = icon ? icon({ size: 14 }) : null;

                    return (
                      <div className="relative">
                        {/* Connector line drawn BEFORE content so it's behind everything */}
                        {/* Now all tools get a connector line since we have a Done node at the end */}
                        <div
                          className="absolute w-px bg-gray-300 dark:bg-gray-600 z-0"
                          style={{
                            left: "10px", // Half of icon width (20px / 2)
                            top: "20px", // Below icon (h-5 = 20px)
                            bottom: "0", // Stop at the bottom of this container, not beyond
                          }}
                        />

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
                          <div
                            className={`flex-1 ${!isLastItem ? "pb-3" : ""}`}
                          >
                            {
                              <div className="flex mt-0.5 mb-1">
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {status}
                                </div>
                              </div>
                            }

                            {content}
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </RendererComponent>
              );
            })}

            {/* Done node at the bottom - only show after all tools are displayed */}
            {allToolsDisplayed && (
              <div className="relative">
                {/* Connector line from previous tool */}
                <div
                  className="absolute w-px bg-gray-300 dark:bg-gray-600 z-0"
                  style={{
                    left: "10px",
                    top: "0",
                    height: "20px",
                  }}
                />

                {/* Main row with icon and content */}
                <div
                  className={`flex items-start gap-2 ${STANDARD_TEXT_COLOR} relative z-10 pb-3`}
                >
                  {/* Icon column */}
                  <div className="flex flex-col items-center w-5">
                    {/* Dot with background to cover the line */}
                    <div className="flex-shrink-0 flex items-center justify-center w-5 h-5 bg-background rounded-full">
                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-700 rounded-full" />
                    </div>
                  </div>

                  {/* Content with padding */}
                  <div className="flex-1">
                    <div className="flex mt-0.5 mb-1">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Done
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MultiToolRenderer;
