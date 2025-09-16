"use client";

import React, {
  ForwardedRef,
  forwardRef,
  useContext,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatSession } from "@/app/chat/interfaces";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { IconProps, OnyxLogoTypeIcon } from "@/components/icons/icons";
import { pageType } from "@/components/sidebar/types";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { useUser } from "@/components/user/UserProvider";
import Text from "@/components-2/Text";
import { UserDropdown } from "@/components/UserDropdown";
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
import { groupSessionsByDateRange } from "@/app/chat/services/lib";
import { ChatSessionDisplay } from "@/components/sidebar/ChatSessionDisplay";

interface SidebarButtonProps {
  icon: React.FunctionComponent<IconProps>;
  title: string;
  active?: boolean;
  noKebabMenu?: boolean;
  grey?: boolean;
}

function SidebarButton({
  icon: Icon,
  title,
  active,
  noKebabMenu,
  grey,
}: SidebarButtonProps) {
  return (
    <button
      className={`w-full flex flex-row gap-spacing-interline p-spacing-interline hover:bg-background-tint-01 ${active && "bg-background-tint-00"} rounded-08 items-center group`}
    >
      <Icon
        className={`w-[1.2rem] ${grey ? "stroke-text-02" : "stroke-text-03"}`}
      />
      <Text text02={grey} text03={!grey}>
        {title}
      </Text>
      <div className="flex-1" />
      {!noKebabMenu && (
        <SvgMoreHorizontal className="hidden group-hover:block stroke-text-03 w-[1rem]" />
      )}
    </button>
  );
}

interface SortableItemProps {
  id: number;
  children?: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 40ms ease-out",
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

interface SidebarSectionProps {
  title: string;
  children?: React.ReactNode;
}

function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-spacing-interline">
      <Text secondary text02 className="px-padding-button">
        {title}
      </Text>
      <div className="">{children}</div>
    </div>
  );
}

interface HistorySidebarProps {
  liveAssistant?: MinimalPersonaSnapshot | null;
  page: pageType;
  existingChats?: ChatSession[];
  currentChatSession?: ChatSession | null | undefined;
  toggleSidebar?: () => void;
  toggled?: boolean;
  removeToggle?: () => void;
  reset?: () => void;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  explicitlyUntoggle: () => void;
  setShowAssistantsModal: (show: boolean) => void;
  toggleChatSessionSearchModal?: () => void;
}

function HistorySidebarInner(
  {
    liveAssistant,
    reset = () => null,
    setShowAssistantsModal = () => null,
    toggled,
    page,
    existingChats,
    currentChatSession,
    explicitlyUntoggle,
    toggleSidebar,
    removeToggle,
    showShareModal,
    toggleChatSessionSearchModal,
    showDeleteModal,
  }: HistorySidebarProps,
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

  if (!combinedSettings) {
    return null;
  }

  const currentChatId = currentChatSession?.id;
  const handleNewChat = () => {
    reset();
    console.log("currentChatSession", currentChatSession);

    const newChatUrl =
      `/${page}` +
      (currentChatSession
        ? `?assistantId=${currentChatSession.persona_id}`
        : "");
    router.push(newChatUrl);
  };

  const liveAgentIsNotPinned = pinnedAgents.every(
    (agent) => agent.id !== liveAssistant?.id
  );

  // Get all chats and group by date range (ignoring folders)
  const groupedChatSessions = groupSessionsByDateRange(existingChats || []);

  const isHistoryEmpty = !existingChats || existingChats.length === 0;

  return (
    <div className="h-screen w-[15rem] flex flex-col bg-background-tint-02 px-padding-button py-padding-content">
      <div className="flex flex-col gap-padding-content flex-1">
        <div className="flex flex-row justify-between items-center px-spacing-interline">
          <OnyxLogoTypeIcon size={100} />
          <SvgSidebar className="cursor-pointer hover:stroke-text-04 stroke-text-03 w-[1.2rem]" />
        </div>
        <SidebarButton icon={SvgEditBig} title="New Session" noKebabMenu />
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
              {pinnedAgents.map((agent: MinimalPersonaSnapshot, index) => (
                <SortableItem id={agent.id} key={index}>
                  <SidebarButton icon={SvgLightbulbSimple} title={agent.name} />
                </SortableItem>
              ))}
              {liveAssistant && liveAgentIsNotPinned && (
                <SortableItem id={liveAssistant.id}>
                  <SidebarButton
                    icon={SvgLightbulbSimple}
                    title={liveAssistant.name}
                  />
                </SortableItem>
              )}
            </SortableContext>
          </DndContext>
          <SidebarButton
            icon={SvgMoreHorizontal}
            title="More Agents"
            noKebabMenu
            grey
          />
        </SidebarSection>
        <SidebarSection title="Recents">
          {isHistoryEmpty ? (
            <Text secondary text01 className="px-padding-button">
              Try sending a message! Your chat history will appear here.
            </Text>
          ) : (
            Object.entries(groupedChatSessions)
              .filter(([_groupName, chats]) => chats.length > 0)
              .map(([groupName, chats]) => (
                <div key={groupName} className="mb-4">
                  <Text secondary text02 className="px-padding-button mb-2">
                    {groupName}
                  </Text>
                  <div className="space-y-1">
                    {chats.map((chat) => (
                      <div key={chat.id} className="-ml-4 bg-transparent -mr-2">
                        <ChatSessionDisplay
                          chatSession={chat}
                          isSelected={currentChatId === chat.id}
                          showShareModal={showShareModal}
                          showDeleteModal={showDeleteModal}
                          closeSidebar={removeToggle}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))
          )}
        </SidebarSection>
      </div>
      <div className="px-spacing-interline flex flex-row">
        <UserDropdown />
      </div>
    </div>
  );
}

export const HistorySidebar = React.memo(forwardRef(HistorySidebarInner));
HistorySidebar.displayName = "HistorySidebar";
