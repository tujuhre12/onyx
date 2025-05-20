import { ChatSession } from "../interfaces";
import {
  createFolder,
  updateFolderName,
  deleteFolder,
  addChatToFolder,
  updateFolderDisplayPriorities,
} from "../folders/FolderManagement";
import { Folder } from "../folders/interfaces";
import { usePopup } from "@/components/admin/connectors/Popup";
import { useRouter } from "next/navigation";
import { FiPlus, FiCheck, FiX } from "react-icons/fi";
import { FolderDropdown } from "../folders/FolderDropdown";
import { ChatSessionDisplay } from "./ChatSessionDisplay";
import { useState, useCallback, useRef, useContext, useEffect } from "react";
import { Caret } from "@/components/icons/icons";
import { groupSessionsByDateRange } from "../lib";
import React from "react";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Expand, ListTree, Search } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useChatContext } from "@/components/context/ChatContext";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Separator } from "@/components/ui/separator";
import ChatGroup from "./ChatGroup";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface SortableFolderProps {
  folder: Folder;
  children: React.ReactNode;
  currentChatId?: string;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  closeSidebar?: () => void;
  onEdit: (folderId: number, newName: string) => void;
  onDelete: (folderId: number) => void;
  onDrop: (folderId: number, chatSessionId: string) => void;
  index: number;
}

const SortableFolder: React.FC<SortableFolderProps> = (props) => {
  const settings = useContext(SettingsContext);
  const mobile = settings?.isMobile;
  const [isDragging, setIsDragging] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isDraggingDndKit,
  } = useSortable({
    id: props.folder.folder_id?.toString() ?? "",
    disabled: mobile,
  });
  const ref = useRef<HTMLDivElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : "auto",
    position: isDragging ? "relative" : "static",
    opacity: isDragging ? 0.6 : 1,
  };

  useEffect(() => {
    setIsDragging(isDraggingDndKit);
  }, [isDraggingDndKit]);

  return (
    <div
      ref={setNodeRef}
      className="pr-3 ml-4 overflow-visible flex items-start"
      style={style}
      {...attributes}
      {...listeners}
    >
      <FolderDropdown ref={ref} {...props} />
    </div>
  );
};

function ToolTipHelper({
  icon,
  toolTipContent,
  onClick,
}: {
  icon: React.ReactNode;
  toolTipContent: string;
  onClick?: () => void;
}) {
  return (
    <TooltipProvider delayDuration={1000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="border-0 border-red-50 px-2"
            onClick={onClick}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{toolTipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function PagesTab({
  existingChats,
  currentChatId,
  folders,
  closeSidebar,
  showShareModal,
  showDeleteModal,
  toggleChatSessionSearchModal,
}: {
  existingChats?: ChatSession[];
  currentChatId?: string;
  folders?: Folder[];
  toggleChatSessionSearchModal?: () => void;
  closeSidebar?: () => void;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
}) {
  const { setPopup, popup } = usePopup();
  const router = useRouter();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const { reorderFolders, refreshFolders, refreshChatSessions } =
    useChatContext();

  const handleEditFolder = useCallback(
    async (folderId: number, newName: string) => {
      try {
        await updateFolderName(folderId, newName);
        setPopup({
          message: "Folder updated successfully",
          type: "success",
        });
        await refreshFolders();
      } catch (error) {
        console.error("Failed to update folder:", error);
        setPopup({
          message: `Failed to update folder: ${(error as Error).message}`,
          type: "error",
        });
      }
    },
    [router, setPopup, refreshChatSessions, refreshFolders]
  );

  const handleDeleteFolder = useCallback(
    (folderId: number) => {
      if (
        confirm(
          "Are you sure you want to delete this folder? This action cannot be undone."
        )
      ) {
        deleteFolder(folderId)
          .then(() => {
            router.refresh();
            setPopup({
              message: "Folder deleted successfully",
              type: "success",
            });
          })
          .catch((error: Error) => {
            console.error("Failed to delete folder:", error);
            setPopup({
              message: `Failed to delete folder: ${error.message}`,
              type: "error",
            });
          });
      }
    },
    [router, setPopup]
  );

  const handleCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setTimeout(() => {
      newFolderInputRef.current?.focus();
    }, 0);
  }, []);

  const handleNewFolderSubmit = useCallback(
    async (e: React.FormEvent<HTMLDivElement>) => {
      e.preventDefault();
      const newFolderName = newFolderInputRef.current?.value;
      if (newFolderName) {
        try {
          await createFolder(newFolderName);
          await refreshFolders();
          router.refresh();
          setPopup({
            message: "Folder created successfully",
            type: "success",
          });
        } catch (error) {
          console.error("Failed to create folder:", error);
          setPopup({
            message:
              error instanceof Error
                ? error.message
                : "Failed to create folder",
            type: "error",
          });
        }
      }
      setIsCreatingFolder(false);
    },
    [router, setPopup, refreshFolders]
  );

  const existingChatsNotinFolders = existingChats?.filter(
    (chat) =>
      !folders?.some((folder) =>
        folder.chat_sessions?.some((session) => session.id === chat.id)
      )
  );

  const groupedChatSesssions = groupSessionsByDateRange(
    existingChatsNotinFolders || []
  );

  const isHistoryEmpty = !existingChats || existingChats.length === 0;

  const handleDrop = useCallback(
    async (folderId: number, chatSessionId: string) => {
      try {
        await addChatToFolder(folderId, chatSessionId);
        router.refresh();
        setPopup({
          message: "Chat added to folder successfully",
          type: "success",
        });
      } catch (error: unknown) {
        console.error("Failed to add chat to folder:", error);
        setPopup({
          message: `Failed to add chat to folder: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          type: "error",
        });
      }
      // await refreshChatSessions();
      await refreshFolders();
    },
    [router, setPopup]
  );

  const [isDraggingSessionId, setIsDraggingSessionId] = useState<string | null>(
    null
  );

  const renderChatSession = useCallback(
    (chat: ChatSession, foldersExisting: boolean) => {
      return (
        <div
          key={chat.id}
          className="-ml-4 bg-transparent  -mr-2"
          draggable
          style={{
            touchAction: "none",
          }}
          onDragStart={(e) => {
            setIsDraggingSessionId(chat.id);
            e.dataTransfer.setData("text/plain", chat.id);
          }}
          onDragEnd={() => setIsDraggingSessionId(null)}
        >
          <ChatSessionDisplay
            chatSession={chat}
            isSelected={currentChatId === chat.id}
            showShareModal={showShareModal}
            showDeleteModal={showDeleteModal}
            closeSidebar={closeSidebar}
            isDragging={isDraggingSessionId === chat.id}
          />
        </div>
      );
    },
    [currentChatId, showShareModal, showDeleteModal, closeSidebar]
  );

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

      if (active.id !== over?.id && folders) {
        const oldIndex = folders.findIndex(
          (f) => f.folder_id?.toString() === active.id
        );
        const newIndex = folders.findIndex(
          (f) => f.folder_id?.toString() === over?.id
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(folders, oldIndex, newIndex);
          const displayPriorityMap = newOrder.reduce(
            (acc, folder, index) => {
              if (folder.folder_id !== undefined) {
                acc[folder.folder_id] = index;
              }
              return acc;
            },
            {} as Record<number, number>
          );

          updateFolderDisplayPriorities(displayPriorityMap);
          reorderFolders(displayPriorityMap);
        }
      }
    },
    [folders]
  );

  const length = Object.entries(groupedChatSesssions).length;
  const [expands, setExpands] = useState<boolean[]>(Array(length).fill(true));
  const expandAll = () => {
    setExpands(Array(length).fill(true));
  };
  const collapseAll = () => {
    setExpands(Array(length).fill(false));
  };

  return (
    <div className="flex flex-col gap-y-2 flex-grow">
      {popup}

      {isCreatingFolder && (
        <div className="px-4">
          <div className="flex  overflow-visible items-center w-full text-text-500 rounded-md p-1 relative">
            <Caret size={16} className="flex-none mr-1" />
            <input
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNewFolderSubmit(e);
                }
              }}
              ref={newFolderInputRef}
              type="text"
              placeholder="Enter group name"
              className="text-sm font-medium bg-transparent outline-none w-full pb-1 border-b border-background-500 transition-colors duration-200"
            />
            <div className="flex -my-1">
              <div
                onClick={handleNewFolderSubmit}
                className="cursor-pointer px-1"
              >
                <FiCheck size={14} />
              </div>
              <div
                onClick={() => setIsCreatingFolder(false)}
                className="cursor-pointer px-1"
              >
                <FiX size={14} />
              </div>
            </div>
          </div>
        </div>
      )}

      <Separator className="mb-0" />

      <SidebarProvider>
        <SidebarContent>
          <SidebarGroup className="gap-y-2">
            <div className="flex flex-row items-center">
              <SidebarGroupLabel className="text-gray-500 flex flex-1 border-0 border-red-50">
                Chats
              </SidebarGroupLabel>
              <ToolTipHelper
                icon={<Search color="grey" />}
                toolTipContent="Search through chats"
                onClick={toggleChatSessionSearchModal}
              />
              <ToolTipHelper
                icon={<FiPlus color="grey" />}
                toolTipContent="Create new chat group"
                onClick={handleCreateFolder}
              />
              <ToolTipHelper
                icon={<ListTree color="grey" />}
                toolTipContent="Collapse all folds"
                onClick={collapseAll}
              />
              <ToolTipHelper
                icon={<Expand color="grey" />}
                toolTipContent="Expand all folds"
                onClick={expandAll}
              />
            </div>
            {Object.entries(groupedChatSesssions).map(
              ([name, chats], index) => (
                <ChatGroup
                  key={name}
                  name={name}
                  chatSessions={chats}
                  expanded={expands[index]}
                  toggleExpanded={() => {
                    const newExpands = Array.from(expands);
                    newExpands[index] = !newExpands[index];
                    setExpands(newExpands);
                  }}
                  selectedId={currentChatId}
                />
              )
            )}
          </SidebarGroup>
        </SidebarContent>
      </SidebarProvider>

      {folders && folders.length > 0 && (
        <DndContext
          modifiers={[restrictToVerticalAxis]}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={folders.map((f) => f.folder_id?.toString() ?? "")}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {folders
                .sort(
                  (a, b) =>
                    (a.display_priority ?? 0) - (b.display_priority ?? 0)
                )
                .map((folder, index) => (
                  <SortableFolder
                    key={folder.folder_id}
                    folder={folder}
                    currentChatId={currentChatId}
                    showShareModal={showShareModal}
                    showDeleteModal={showDeleteModal}
                    closeSidebar={closeSidebar}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                    onDrop={handleDrop}
                    index={index}
                  >
                    {folder.chat_sessions &&
                      folder.chat_sessions.map((chat) =>
                        renderChatSession(
                          chat,
                          folders != undefined && folders.length > 0
                        )
                      )}
                  </SortableFolder>
                ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="pl-4 pr-3">
        {!isHistoryEmpty &&
          Object.entries(groupedChatSesssions)
            .filter(([groupName, chats]) => chats.length > 0)
            .map(([groupName, chats], index) => (
              <FolderDropdown
                key={groupName}
                folder={{
                  folder_name: groupName,
                  chat_sessions: chats,
                  display_priority: 0,
                }}
                currentChatId={currentChatId}
                showShareModal={showShareModal}
                closeSidebar={closeSidebar}
                onEdit={handleEditFolder}
                onDrop={handleDrop}
                index={folders ? folders.length + index : index}
              >
                {chats.map((chat) =>
                  renderChatSession(
                    chat,
                    folders != undefined && folders.length > 0
                  )
                )}
              </FolderDropdown>
            ))}

        {isHistoryEmpty && (!folders || folders.length === 0) && (
          <p className="text-sm max-w-full mt-2 w-[250px]">
            Try sending a message! Your chat history will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
