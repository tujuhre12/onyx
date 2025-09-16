"use client";

import React, {
  ForwardedRef,
  forwardRef,
  useContext,
  useCallback,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatSession } from "@/app/chat/interfaces";
import { Folder } from "@/app/chat/components/folders/interfaces";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import {
  DocumentIcon2,
  EditIcon,
  IconProps,
  KnowledgeGroupIcon,
  NewChatIcon,
  OnyxIcon,
  OnyxLogoTypeIcon,
} from "@/components/icons/icons";
import { PagesTab } from "@/components/sidebar/PagesTab";
import { AgentsTab } from "@/components/sidebar/AgentsTab";
import { pageType } from "@/components/sidebar/types";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { useUser } from "@/components/user/UserProvider";
import Text from "@/components-2/Text";
import { FolderIcon, Ellipsis } from "lucide-react";
import { UserDropdown } from "@/components/UserDropdown";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { DragEndEvent } from "@dnd-kit/core";
import { useAssistantsContext } from "@/components/context/AssistantsContext";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { buildChatUrl } from "@/app/chat/services/lib";
import { reorderPinnedAssistants } from "@/lib/assistants/updateAssistantPreferences";
import { DragHandle } from "@/components/table/DragHandle";
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
import { CircleX, PinIcon } from "lucide-react";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { TruncatedText } from "@/components/ui/truncatedText";

interface SidebarButtonProps {
  icon: React.FunctionComponent<IconProps>;
  title: string;
  active?: boolean;
  grey?: boolean;
}

function SidebarButton({
  icon: Icon,
  title,
  active,
  grey,
}: SidebarButtonProps) {
  return (
    <button
      className={`w-full flex flex-row gap-spacing-interline px-padding-button py-spacing-interline hover:bg-background-tint-01 ${active && "bg-background-tint-00"} rounded-08 items-center`}
    >
      <Icon className="dbg-red" />
      <Text text03>{title}</Text>
    </button>
  );
}

interface SortableAssistantProps {
  assistant: MinimalPersonaSnapshot;
  active: boolean;
  onClick: () => void;
  onPinAction: (e: React.MouseEvent) => void;
  pinned?: boolean;
}

function SortableAssistant({
  assistant,
  active,
  onClick,
  onPinAction,
  pinned = true,
}: SortableAssistantProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: assistant.id === 0 ? "assistant-0" : assistant.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 1000, position: "relative" as const } : {}),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center group"
    >
      <DragHandle
        size={16}
        className={`w-3 ml-[2px] mr-[2px] group-hover:visible invisible flex-none cursor-grab ${!pinned && "opacity-0"}`}
      />
      <div
        data-testid={`assistant-[${assistant.id}]`}
        onClick={(e) => {
          e.preventDefault();
          if (!isDragging) {
            onClick();
          }
        }}
        className={`cursor-pointer w-full group hover:bg-background-tint-00 ${active && "bg-background-tint-00"} relative flex items-center gap-x-2 py-1 px-2 rounded-md`}
      >
        <AssistantIcon assistant={assistant} size={16} className="flex-none" />
        <TruncatedText
          className="text-base mr-4 text-left w-fit line-clamp-1 text-ellipsis text-text-03 font-main"
          text={assistant.name}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPinAction(e);
                }}
                className="group-hover:block hidden absolute right-2"
              >
                {pinned ? (
                  <CircleX size={16} className="text-text-03" />
                ) : (
                  <PinIcon size={16} className="text-text-03" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {pinned
                ? "Unpin this assistant from the sidebar"
                : "Pin this assistant to the sidebar"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
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
      {children}
    </div>
  );
}

interface HistorySidebarProps {
  liveAssistant?: MinimalPersonaSnapshot | null;
  page: pageType;
  existingChats?: ChatSession[];
  currentChatSession?: ChatSession | null | undefined;
  folders?: Folder[];
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
    folders,
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
  const { refreshAssistants, pinnedAssistants, setPinnedAssistants } =
    useAssistantsContext();
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

  return (
    <div className="h-screen w-[240px] flex flex-col bg-background-tint-02 px-padding-button py-spacing-paragraph">
      <div className="flex flex-col gap-padding-content flex-1">
        <div className="flex flex-row justify-between px-spacing-inline">
          <OnyxLogoTypeIcon size={100} />
          <div />
        </div>
        <SidebarButton icon={EditIcon} title="New Session" />
        <SidebarSection title="Agents">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={pinnedAssistants.map((a) =>
                a.id === 0 ? "assistant-0" : a.id
              )}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex px-0 mr-4 flex-col gap-y-1 mt-1">
                {pinnedAssistants.map((assistant: MinimalPersonaSnapshot) => (
                  <SortableAssistant
                    key={assistant.id === 0 ? "assistant-0" : assistant.id}
                    assistant={assistant}
                    active={assistant.id === liveAssistant?.id}
                    onClick={() => {
                      router.push(
                        buildChatUrl(searchParams, null, assistant.id)
                      );
                    }}
                    onPinAction={async (e: React.MouseEvent) => {
                      e.stopPropagation();
                      await toggleAssistantPinnedStatus(
                        pinnedAssistants.map((a) => a.id),
                        assistant.id,
                        false
                      );
                      await refreshAssistants();
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {!pinnedAssistants.some((a) => a.id === liveAssistant?.id) &&
            liveAssistant && (
              <div className="w-full mt-1 pr-4">
                <SortableAssistant
                  pinned={false}
                  assistant={liveAssistant}
                  active={liveAssistant.id === liveAssistant?.id}
                  onClick={() => {
                    router.push(
                      buildChatUrl(searchParams, null, liveAssistant.id)
                    );
                  }}
                  onPinAction={async (e: React.MouseEvent) => {
                    e.stopPropagation();
                    await toggleAssistantPinnedStatus(
                      [...pinnedAssistants.map((a) => a.id)],
                      liveAssistant.id,
                      true
                    );
                    await refreshAssistants();
                  }}
                />
              </div>
            )}

          {/* <SidebarButton icon={MoreHorizontalIcon} title="More Assistants" /> */}

          {/* <div className="w-full px-4">
            <button
              aria-label="Explore Assistants"
              onClick={() => setShowAssistantsModal(true)}
              className="w-full hover:bg-background-tint-00 flex items-center gap-x-2 py-1 px-2 rounded-md"
            >
              <Ellipsis size={16} className="stroke-text-02" />
              <Text text02>More Agents</Text>
            </button>
          </div> */}
        </SidebarSection>
        <SidebarSection title="Recents" />
      </div>
      <UserDropdown />
    </div>
  );
}

export const HistorySidebar = React.memo(forwardRef(HistorySidebarInner));
HistorySidebar.displayName = "HistorySidebar";
