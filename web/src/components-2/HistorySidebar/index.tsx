"use client";

import React, {
  ForwardedRef,
  forwardRef,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatSession } from "@/app/chat/interfaces";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { OnyxLogoTypeIcon, OnyxIcon } from "@/components/icons/icons";
import { pageType } from "@/components/sidebar/types";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { useUser } from "@/components/user/UserProvider";
import Text from "@/components-2/Text";
import { DragEndEvent } from "@dnd-kit/core";
import { useAssistantsContext } from "@/components/context/AssistantsContext";
import { reorderPinnedAssistants } from "@/lib/assistants/updateAssistantPreferences";
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
import Settings from "@/components-2/HistorySidebar/Settings";
import {
  AgentsMenu,
  SidebarButton,
  SidebarSection,
} from "@/components-2/HistorySidebar/components";
import AssistantModal from "@/app/assistants/mine/AssistantModal";
import { useChatContext } from "@/components/context/ChatContext";
import SvgBubbleText from "@/icons/bubble-text";

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
        zIndex: 100,
        ...(isDragging ? { zIndex: 1000, position: "relative" as const } : {}),
      }}
      {...attributes}
      {...listeners}
      className="flex items-center group"
    >
      {children}
    </div>
  );
}

interface HistorySidebarProps {
  liveAssistant?: MinimalPersonaSnapshot | null;
  page: pageType;
  currentChatSession?: ChatSession | null | undefined;
}

function HistorySidebarInner(
  { liveAssistant, page, currentChatSession }: HistorySidebarProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toggleAssistantPinnedStatus } = useUser();
  const {
    refreshAssistants,
    pinnedAssistants: pinnedAgents,
    setPinnedAssistants,
  } = useAssistantsContext();
  const combinedSettings = useContext(SettingsContext);
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

      if (active.id !== over?.id) {
        setPinnedAssistants((prevAssistants: MinimalPersonaSnapshot[]) => {
          const oldIndex = prevAssistants.findIndex(
            (a: MinimalPersonaSnapshot) =>
              (a.id === 0 ? "assistant-0" : a.id) === active.id
          );
          const newIndex = prevAssistants.findIndex(
            (a: MinimalPersonaSnapshot) =>
              (a.id === 0 ? "assistant-0" : a.id) === over?.id
          );

          const newOrder = arrayMove(prevAssistants, oldIndex, newIndex);

          // Ensure we're sending the correct IDs to the API
          const reorderedIds = newOrder.map(
            (a: MinimalPersonaSnapshot) => a.id
          );
          reorderPinnedAssistants(reorderedIds);

          return newOrder;
        });
      }
    },
    [setPinnedAssistants, reorderPinnedAssistants]
  );
  const [folded, setFolded] = useState<boolean>(false);
  const [insideHistorySidebarBoundingBox, setInsideHistorySidebarBoundingBox] =
    useState<boolean>(false);
  const [agentsModalOpen, setAgentsModalOpen] = useState<boolean>(false);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isModifierPressed = isMac ? event.metaKey : event.ctrlKey;

      if (isModifierPressed && event.key === "e") {
        event.preventDefault();
        setFolded((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const { chatSessions } = useChatContext();

  if (!combinedSettings) {
    return null;
  }

  function handleNewChat() {
    console.log("currentChatSession", currentChatSession);

    const newChatUrl =
      `/${page}` +
      (currentChatSession
        ? `?assistantId=${currentChatSession.persona_id}`
        : "");
    router.push(newChatUrl);
  }
  const currentChatId = currentChatSession?.id;
  const liveAgentIsNotPinned = pinnedAgents.every(
    (agent) => agent.id !== liveAssistant?.id
  );
  // const groupedChatSessions = groupSessionsByDateRange(existingChats || []);
  const isHistoryEmpty = !chatSessions || chatSessions.length === 0;

  return (
    <>
      {agentsModalOpen && (
        <AssistantModal hideModal={() => setAgentsModalOpen(false)} />
      )}

      <div
        className={`h-screen ${folded ? "w-[4rem]" : "w-[15rem]"} flex flex-col bg-background-tint-02 ${folded ? "px-spacing-interline" : "px-padding-button"} py-padding-content flex-shrink-0 gap-padding-content`}
        onMouseOver={() => setInsideHistorySidebarBoundingBox(true)}
        onMouseLeave={() => setInsideHistorySidebarBoundingBox(false)}
      >
        {/* Header - fixed height */}
        <div
          className={`flex flex-row items-center px-spacing-interline ${folded ? "justify-center" : "justify-between"} flex-shrink-0`}
        >
          {folded ? (
            <div className="h-[1.6rem] flex flex-col items-center justify-center">
              {insideHistorySidebarBoundingBox ? (
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
                  setInsideHistorySidebarBoundingBox(false);
                }}
              />
            </>
          )}
        </div>

        <SidebarButton icon={SvgEditBig} hideTitle={folded}>
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
                    items={pinnedAgents.map((agent) => agent.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {pinnedAgents.map(
                      (agent: MinimalPersonaSnapshot, index) => (
                        <SortableItem id={agent.id} key={index}>
                          <SidebarButton
                            icon={SvgLightbulbSimple}
                            kebabMenu={<AgentsMenu />}
                          >
                            {agent.name}
                          </SidebarButton>
                        </SortableItem>
                      )
                    )}
                    {liveAssistant && liveAgentIsNotPinned && (
                      <SortableItem id={liveAssistant.id}>
                        <SidebarButton icon={SvgLightbulbSimple}>
                          {liveAssistant.name}
                        </SidebarButton>
                      </SortableItem>
                    )}
                  </SortableContext>
                </DndContext>
                <SidebarButton
                  icon={SvgMoreHorizontal}
                  grey
                  onClick={() => setAgentsModalOpen(true)}
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
                    <SidebarButton icon={SvgBubbleText}>
                      {chatSession.name ? (
                        chatSession.name
                      ) : (
                        <Text text01>Unnamed Chat</Text>
                      )}
                    </SidebarButton>
                  ))
                )}
              </SidebarSection>
            </>
          )}
        </div>

        {/* Footer - fixed height */}
        <div className="px-spacing-inline flex flex-col flex-shrink-0">
          <Settings folded={folded} />
        </div>
      </div>
    </>
  );
}

export const HistorySidebar = React.memo(forwardRef(HistorySidebarInner));
HistorySidebar.displayName = "HistorySidebar";
