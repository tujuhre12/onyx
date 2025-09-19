"use client";

import React, { useCallback, useState, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSettingsContext } from "@/components/settings/SettingsProvider";
import { OnyxLogoTypeIcon, OnyxIcon } from "@/components/icons/icons";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import Text from "@/components-2/Text";
import { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SvgSidebar from "@/icons/sidebar";
import SvgEditBig from "@/icons/edit-big";
import SvgMoreHorizontal from "@/icons/more-horizontal";
import SvgLightbulbSimple from "@/icons/lightbulb-simple";
import Settings from "@/sections/AppSidebar/Settings";
import {
  AgentsMenu,
  RecentChatMenu,
  SidebarButton,
  SidebarSection,
} from "@/sections/AppSidebar/components";
import AgentsModal from "@/sections/AgentsModal";
import { useChatContext } from "@/components/context/ChatContext";
import SvgBubbleText from "@/icons/bubble-text";
import { buildChatUrl } from "@/app/chat/services/lib";
import { useAgentsContext } from "@/components-2/context/AgentsContext";
import { useAppSidebarContext } from "@/components-2/context/AppSidebarContext";
import { ModalIds, useModal } from "@/components-2/context/ModalContext";

// Visible-agents = pinned-agents + current-agent (if current-agent not in pinned-agents)
// OR Visible-agents = pinned-agents (if current-agent in pinned-agents)
function buildVisibleAgents(
  pinnedAgents: MinimalPersonaSnapshot[],
  currentAgent: MinimalPersonaSnapshot | null
): [MinimalPersonaSnapshot[], boolean] {
  if (!currentAgent) return [pinnedAgents, false];
  const currentAgentIsPinned = pinnedAgents.some(
    (pinnedAgent) => pinnedAgent.id === currentAgent.id
  );
  const visibleAgents = currentAgentIsPinned
    ? pinnedAgents
    : [...pinnedAgents, currentAgent];
  return [visibleAgents, currentAgentIsPinned];
}

interface ChatSessionNameProps {
  chatSession: any;
  onChatSessionClick: (chatSessionId: string | null) => void;
}

function ChatSessionNameInner({
  chatSession,
  onChatSessionClick,
}: ChatSessionNameProps) {
  const [renaming, setRenaming] = useState(false);

  return (
    <SidebarButton
      key={chatSession.id}
      icon={SvgBubbleText}
      // active={currentChatId === chatSession.id}
      onClick={() => onChatSessionClick(chatSession.id)}
      kebabMenu={<RecentChatMenu />}
    >
      {renaming ? (
        <></>
      ) : chatSession.name ? (
        chatSession.name
      ) : (
        <Text text01>Unnamed Chat</Text>
      )}
    </SidebarButton>
  );
}

const ChatSessionName = memo(ChatSessionNameInner);

interface SortableItemProps {
  id: number;
  children?: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        zIndex: 1000,
        ...(isDragging && { zIndex: 1000, position: "relative" as const }),
      }}
      {...attributes}
      {...listeners}
      className="flex items-center group"
    >
      {children}
    </div>
  );
}

export default function AppSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pinnedAgents, setPinnedAgents, togglePinnedAgent, currentAgent } =
    useAgentsContext();
  const { folded, setFolded, foldedAndHovered, setHovered } =
    useAppSidebarContext();
  const { toggleModal } = useModal();
  const { chatSessions } = useChatContext();
  const combinedSettings = useSettingsContext();

  const currentChatId = searchParams?.get("chatId");

  const [visibleAgents, currentAgentIsPinned] = buildVisibleAgents(
    pinnedAgents,
    currentAgent
  );
  const visibleAgentIds = visibleAgents.map((agent) => agent.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;
      if (active.id === over.id) return;

      setPinnedAgents((prev) => {
        const activeIndex = visibleAgentIds.findIndex(
          (agentId) => agentId === active.id
        );
        const overIndex = visibleAgentIds.findIndex(
          (agentId) => agentId === over.id
        );

        if (currentAgent && !currentAgentIsPinned) {
          // This is the case in which the user is dragging the UNPINNED agent and moving it to somewhere else in the list.
          // This is an indication that we WANT to pin this agent!
          if (activeIndex === visibleAgentIds.length - 1) {
            const prevWithVisible = [...prev, currentAgent];
            return arrayMove(prevWithVisible, activeIndex, overIndex);
          }
        }

        return arrayMove(prev, activeIndex, overIndex);
      });
    },
    [visibleAgentIds, setPinnedAgents, currentAgent, currentAgentIsPinned]
  );

  const handleChatSessionClick = useCallback(
    (chatSessionId: string | null) => {
      router.push(buildChatUrl(searchParams, chatSessionId || null, null));
    },
    [router, searchParams]
  );

  const handleAgentClick = useCallback(
    (agentId: number) => {
      router.push(buildChatUrl(searchParams, null, agentId));
    },
    [router, searchParams]
  );

  if (!combinedSettings) {
    return null;
  }

  const isHistoryEmpty = !chatSessions || chatSessions.length === 0;

  return (
    <>
      <AgentsModal />

      <div
        className={`h-screen ${folded ? "w-[4rem]" : "w-[15rem]"} flex flex-col bg-background-tint-02 ${folded ? "px-spacing-interline" : "px-padding-button"} py-padding-content flex-shrink-0 gap-padding-content`}
        onMouseOver={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Header - fixed height */}
        <div
          className={`flex flex-row items-center px-spacing-interline py-spacing-inline ${folded ? "justify-center" : "justify-between"} flex-shrink-0`}
        >
          {folded ? (
            <div className="h-[1.6rem] flex flex-col items-center justify-center">
              {foldedAndHovered ? (
                <SvgSidebar
                  className="cursor-pointer hover:stroke-text-04 stroke-text-03 w-[1rem]"
                  onClick={() => setFolded(false)}
                />
              ) : (
                <OnyxIcon size={24} />
              )}
            </div>
          ) : (
            <>
              <OnyxLogoTypeIcon size={88} />
              <SvgSidebar
                className="cursor-pointer hover:stroke-text-04 stroke-text-03 w-[1rem]"
                onClick={() => {
                  setFolded(true);
                  setHovered(false);
                }}
              />
            </>
          )}
        </div>

        <SidebarButton
          icon={SvgEditBig}
          hideTitle={folded}
          onClick={() => handleChatSessionClick(null)}
          active={!currentChatId && !currentAgent}
        >
          New Session
        </SidebarButton>

        {/* Scrollable content area - takes remaining space */}
        <div className="flex flex-col gap-padding-content flex-1 overflow-y-scroll">
          {!folded && (
            <>
              {/* Agents */}
              <SidebarSection title="Agents">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={visibleAgentIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {visibleAgents.map((visibleAgent, index) => {
                      const pinned = pinnedAgents.some(
                        (pinnedAgent) => pinnedAgent.id === visibleAgent.id
                      );
                      return (
                        <SortableItem id={visibleAgent.id} key={index}>
                          <SidebarButton
                            icon={SvgLightbulbSimple}
                            kebabMenu={
                              <AgentsMenu
                                pinned={pinned}
                                onTogglePin={() =>
                                  togglePinnedAgent(visibleAgent, !pinned)
                                }
                              />
                            }
                            active={currentAgent?.id === visibleAgent.id}
                            onClick={() => handleAgentClick(visibleAgent.id)}
                          >
                            {visibleAgent.name}
                          </SidebarButton>
                        </SortableItem>
                      );
                    })}
                  </SortableContext>
                </DndContext>
                <SidebarButton
                  icon={SvgMoreHorizontal}
                  grey
                  onClick={() => toggleModal(ModalIds.AgentsModal, true)}
                >
                  More Agents
                </SidebarButton>
              </SidebarSection>

              {/* Recents */}
              <SidebarSection title="Recents">
                {isHistoryEmpty ? (
                  <Text secondary text01 className="px-padding-button">
                    Try sending a message! Your chat history will appear here.
                  </Text>
                ) : (
                  chatSessions.map((chatSession) => (
                    <ChatSessionName
                      key={chatSession.id}
                      chatSession={chatSession}
                      onChatSessionClick={handleChatSessionClick}
                    />
                  ))
                )}
              </SidebarSection>
            </>
          )}
        </div>

        {/* Footer - fixed height */}
        <div className="flex flex-col flex-shrink-0">
          <Settings folded={folded} />
        </div>
      </div>
    </>
  );
}
