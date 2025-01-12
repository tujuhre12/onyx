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
import { pageType } from "./types";
import { FiPlus, FiTrash2, FiEdit, FiCheck, FiX } from "react-icons/fi";
import { NEXT_PUBLIC_DELETE_ALL_CHATS_ENABLED } from "@/lib/constants";
import { FolderDropdown } from "../folders/FolderDropdown";
import { ChatSessionDisplay } from "./ChatSessionDisplay";
import { useState, useCallback, useRef, useEffect } from "react";
import { Caret } from "@/components/icons/icons";
import { CaretCircleDown } from "@phosphor-icons/react";
import { groupSessionsByDateRange } from "../lib";
import React from "react";
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
import { DragHandle } from "@/components/table/DragHandle";
import { useChatContext } from "@/components/context/ChatContext";

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
}

const SortableFolder: React.FC<SortableFolderProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: props.folder.folder_id?.toString() ?? "" });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      ref={setNodeRef}
      className="pr-4 overflow-visible flex items-start"
      style={style}
    >
      <DragHandle
        size={16}
        {...attributes}
        {...listeners}
        className={`w-4 mt-1.5 ${
          isHovering ? "visible" : "invisible"
        } flex-none cursor-grab`}
      />
      <FolderDropdown {...props} />
    </div>
  );
};

export function PagesTab({
  existingChats,
  currentChatId,
  folders,
  closeSidebar,
  newFolderId,
  showShareModal,
  showDeleteModal,
  showDeleteAllModal,
  setNewFolderId,
}: {
  existingChats?: ChatSession[];
  currentChatId?: string;
  folders?: Folder[];
  closeSidebar?: () => void;
  newFolderId: number | null;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  showDeleteAllModal?: () => void;
  setNewFolderId: (folderId: number) => void;
}) {
  const { setPopup, popup } = usePopup();
  const router = useRouter();
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const { reorderFolders } = useChatContext();

  const handleEditFolder = useCallback(
    (folderId: number | "chats", newName: string) => {
      if (folderId === "chats") return; // Don't edit the default "Chats" folder
      updateFolderName(folderId, newName)
        .then(() => {
          router.refresh();
          setPopup({
            message: "Folder updated successfully",
            type: "success",
          });
        })
        .catch((error: Error) => {
          console.error("Failed to update folder:", error);
          setPopup({
            message: `Failed to update folder: ${error.message}`,
            type: "error",
          });
        });
    },
    [router, setPopup]
  );

  const handleDeleteFolder = useCallback(
    (folderId: number | "chats") => {
      if (folderId === "chats") return; // Don't delete the default "Chats" folder
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
        await createFolder(newFolderName)
          .then((folderId) => {
            router.refresh();
            setNewFolderId(folderId);
            setPopup({
              message: "Folder created successfully",
              type: "success",
            });
          })
          .catch((error) => {
            console.error("Failed to create folder:", error);
            setPopup({
              message: `Failed to create folder: ${error.message}`,
              type: "error",
            });
          });
      }
      setIsCreatingFolder(false);
    },
    [router, setNewFolderId, setPopup]
  );

  const groupedChatSesssions = groupSessionsByDateRange(existingChats || []);

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
    },
    [router, setPopup]
  );

  const renderChatSession = useCallback(
    (chat: ChatSession) => (
      <div
        key={chat.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", chat.id);
        }}
      >
        <ChatSessionDisplay
          chatSession={chat}
          isSelected={currentChatId === chat.id}
          showShareModal={showShareModal}
          showDeleteModal={showDeleteModal}
          closeSidebar={closeSidebar}
        />
      </div>
    ),
    [currentChatId, showShareModal, showDeleteModal, closeSidebar]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
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

  return (
    <div className="flex flex-col gap-y-2 overflow-y-auto flex-grow">
      <div className="px-4 mt-2 group mr-2">
        <div className="flex justify-between text-sm gap-x-2 text-[#6c6c6c] items-center font-normal leading-normal">
          <p>Chats</p>
          <button
            onClick={handleCreateFolder}
            className="flex group-hover:opacity-100 opacity-0 transition duration-200 cursor-pointer gap-x-1 items-center text-black text-xs font-medium font-['KH Teka TRIAL'] leading-normal"
          >
            <FiPlus size={12} className="flex-none" />
            Create Group
          </button>
        </div>
      </div>

      {isCreatingFolder ? (
        <div className="px-4">
          <div className="flex items-center w-full text-[#6c6c6c] rounded-md  relative">
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
              className="text-sm font-medium border-b border-[#6c6c6c] bg-transparent "
            />
            <div className="flex -my-1">
              <div onClick={handleNewFolderSubmit} className="p-1">
                <FiCheck size={14} />
              </div>
              <div onClick={() => setIsCreatingFolder(false)} className="p-1 ">
                <FiX size={14} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <></>
      )}

      {/* {isEditing && (
          <div className="flex -my-1">
            <button onClick={handleEdit} className="p-1  ">
              <FiCheck size={14} />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-1">
              <FiX size={14} />
            </button>
          </div>
        )}
         */}

      {folders && folders.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={folders.map((f) => f.folder_id?.toString() ?? "")}
            strategy={verticalListSortingStrategy}
          >
            {folders
              .sort(
                (a, b) => (a.display_priority ?? 0) - (b.display_priority ?? 0)
              )
              .map((folder) => (
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
                >
                  {folder.chat_sessions &&
                    folder.chat_sessions.map(renderChatSession)}
                </SortableFolder>
              ))}
          </SortableContext>
        </DndContext>
      )}

      <div
        className={`px-4 ${NEXT_PUBLIC_DELETE_ALL_CHATS_ENABLED && "pb-20"}`}
      >
        {!isHistoryEmpty && (
          <>
            {Object.entries(groupedChatSesssions)
              .filter(([groupName, chats]) => chats.length > 0)
              .map(([groupName, chats]) => (
                <FolderDropdown
                  key={groupName}
                  folder={{
                    folder_name: groupName,
                    chat_sessions: chats,
                    display_priority: 0,
                  }}
                  currentChatId={currentChatId}
                  showShareModal={showShareModal}
                  showDeleteModal={showDeleteModal}
                  closeSidebar={closeSidebar}
                  onEdit={handleEditFolder}
                  onDelete={handleDeleteFolder}
                  onDrop={handleDrop}
                >
                  {chats.map(renderChatSession)}
                </FolderDropdown>
              ))}
          </>
        )}

        {(isHistoryEmpty && !folders) ||
          (folders && folders.length === 0 && (
            <p className="text-sm mt-2 w-[250px]">
              Try sending a message! Your chat history will appear here.
            </p>
          ))}
      </div>
      {showDeleteAllModal && NEXT_PUBLIC_DELETE_ALL_CHATS_ENABLED && (
        <div className="absolute w-full border-t border-t-border bg-background-100 bottom-0 left-0 p-4">
          <button
            className="px-4 w-full py-2 px-4 text-text-600 hover:text-text-800 bg-background-125 border border-border-strong/50 shadow-sm rounded-md transition-colors duration-200 flex items-center justify-center text-sm"
            onClick={showDeleteAllModal}
          >
            <FiTrash2 className="mr-2" size={14} />
            Clear All History
          </button>
        </div>
      )}
    </div>
  );
}
