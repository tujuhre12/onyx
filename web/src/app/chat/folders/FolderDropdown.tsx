import React, {
  useState,
  useRef,
  useEffect,
  ReactNode,
  useCallback,
  forwardRef,
} from "react";
import { Folder } from "./interfaces";
import { ChatSession } from "../interfaces";
import { ChatSessionDisplay } from "../sessionSidebar/ChatSessionDisplay";
import {
  FiChevronDown,
  FiChevronRight,
  FiEdit,
  FiTrash2,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { Caret } from "@/components/icons/icons";
import { addChatToFolder, deleteFolder } from "./FolderManagement";
import { FaPencilAlt } from "react-icons/fa";
import { Pencil } from "@phosphor-icons/react";
import { PencilIcon } from "lucide-react";
import { Popover } from "@/components/popover/Popover";
import { Button } from "@/components/ui/button";
import { useChatContext } from "@/components/context/ChatContext";

interface FolderDropdownProps {
  folder: Folder;
  currentChatId?: string;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  closeSidebar?: () => void;
  onEdit?: (folderId: number, newName: string) => void;
  onDelete?: (folderId: number) => void;
  onDrop?: (folderId: number, chatSessionId: string) => void;
  children?: ReactNode;
}
// import React, { forwardRef } from 'react';

export const FolderDropdown = forwardRef<
  HTMLDivElement,
  {
    folder: Folder;
    currentChatId?: string;
    showShareModal?: (chatSession: ChatSession) => void;
    closeSidebar?: () => void;
    onEdit: (folderId: number, newName: string) => void;
    onDrop: (folderId: number, chatSessionId: string) => void;
    children: React.ReactNode;
  }
>(
  (
    {
      folder,
      currentChatId,
      showShareModal,
      closeSidebar,
      onEdit,
      onDrop,
      children,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [newFolderName, setNewFolderName] = useState(folder.folder_name);
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDeletePopoverOpen, setIsDeletePopoverOpen] = useState(false);
    const editingRef = useRef<HTMLDivElement>(null);
    const { refreshFolders } = useChatContext();

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
      }
    }, [isEditing]);

    const handleEdit = useCallback(() => {
      if (newFolderName && folder.folder_id !== undefined) {
        onEdit(folder.folder_id, newFolderName);
        setIsEditing(false);
      }
    }, [newFolderName, folder.folder_id, onEdit]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          editingRef.current &&
          !editingRef.current.contains(event.target as Node) &&
          isEditing
        ) {
          handleEdit();
        }
      };

      if (isEditing) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isEditing, handleEdit]);

    const handleDeleteClick = useCallback(() => {
      setIsDeletePopoverOpen(true);
    }, []);

    const handleCancelDelete = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDeletePopoverOpen(false);
    }, []);

    const handleConfirmDelete = useCallback(
      async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (folder.folder_id !== undefined) {
          await deleteFolder(folder.folder_id);
        }
        await refreshFolders();
        setIsDeletePopoverOpen(false);
      },
      [folder.folder_id]
    );

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
    };

    const handleDrop = useCallback(
      (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const chatSessionId = e.dataTransfer.getData("text/plain");
        console.log("handleDrop", chatSessionId, folder.folder_id);
        if (folder.folder_id) {
          onDrop(folder.folder_id, chatSessionId);
        }
      },
      [folder.folder_id, onDrop]
    );

    const chatSessionRef = useRef<HTMLDivElement>(null);

    return (
      <div
        ref={chatSessionRef}
        className="overflow-visible w-full"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          ref={ref}
          className="flex overflow-visible items-center w-full text-[#6c6c6c] rounded-md p-1 relative"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            className="flex overflow-hidden items-center flex-grow"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? (
              <Caret size={16} className="mr-1" />
            ) : (
              <Caret size={16} className="-rotate-90 mr-1" />
            )}
            {isEditing ? (
              <div ref={editingRef}>
                <input
                  ref={inputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="text-sm font-medium bg-transparent outline-none w-full pb-1 border-b border-[#6c6c6c] transition-colors duration-200"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleEdit();
                    }
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center">
                <span className="text-sm font-medium">
                  {folder.folder_name}
                </span>
              </div>
            )}
          </button>
          {isHovered && !isEditing && folder.folder_id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="ml-auto px-1"
            >
              <PencilIcon size={14} />
            </button>
          )}
          {isHovered && !isEditing && folder.folder_id && (
            <Popover
              open={isDeletePopoverOpen}
              onOpenChange={setIsDeletePopoverOpen}
              content={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClick();
                  }}
                  className="px-1"
                >
                  <FiTrash2 size={14} />
                </button>
              }
              popover={
                <div className="p-3 w-64 border border-border rounded-lg bg-background z-50">
                  <p className="text-sm mb-3">
                    Are you sure you want to delete this folder?
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      className="px-3 py-1 text-sm bg-gray-200 rounded"
                      onClick={handleCancelDelete}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded"
                      onClick={handleConfirmDelete}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              }
              requiresContentPadding
              sideOffset={6}
            />
          )}
          {isEditing && (
            <div className="flex -my-1">
              <button onClick={handleEdit} className="p-1  ">
                <FiCheck size={14} />
              </button>
              <button onClick={() => setIsEditing(false)} className="p-1">
                <FiX size={14} />
              </button>
            </div>
          )}
        </div>
        {isOpen && (
          <div className="overflow-visible mr-3 ml-1 mt-1">{children}</div>
        )}
      </div>
    );
  }
);

FolderDropdown.displayName = "FolderDropdown";
