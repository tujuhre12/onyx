import React, {
  useState,
  useRef,
  useEffect,
  ReactNode,
  useCallback,
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
import { addChatToFolder } from "./FolderManagement";
import { FaPencilAlt } from "react-icons/fa";
import { Pencil } from "@phosphor-icons/react";
import { PencilIcon } from "lucide-react";
import SlideOverModal from "@/components/ui/SlideOverModal";
import { Button } from "@/components/ui/button";

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

export function FolderDropdown({
  folder,
  currentChatId,
  showShareModal,
  showDeleteModal,
  closeSidebar,
  onEdit,
  onDelete,
  onDrop,
  children,
}: {
  folder: Folder;
  currentChatId?: string;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  closeSidebar?: () => void;
  onEdit: (folderId: number, newName: string) => void;
  onDelete: (folderId: number) => void;
  onDrop: (folderId: number, chatSessionId: string) => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newFolderName, setNewFolderName] = useState(folder.folder_name);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleEdit = useCallback(() => {
    console.log("handleEdit", newFolderName, folder.folder_id);
    if (newFolderName && folder.folder_id !== undefined) {
      onEdit(folder.folder_id, newFolderName);
      setIsEditing(false);
    }
  }, [newFolderName, folder.folder_id, onEdit]);

  const handleDelete = useCallback(() => {
    if (folder.folder_id !== undefined) {
      onDelete(folder.folder_id);
    }
  }, [folder.folder_id, onDelete]);

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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const chatSessionRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={chatSessionRef}
      className="overflow-visible w-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className="flex  overflow-visible items-center w-full text-[#6c6c6c] rounded-md p-1 relative"
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
            <input
              ref={inputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="text-sm font-medium bg-transparent outline-none w-full pb-1 border-b border-[#6c6c6c] transition-colors duration-200"
            />
          ) : (
            <div className="flex items-center">
              <span className="text-sm font-medium">{folder.folder_name}</span>
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
          <button onClick={() => setIsDeleteModalOpen(true)} className="px-1 ">
            <FiTrash2 size={14} />
          </button>
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

      <SlideOverModal
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        anchor={chatSessionRef}
      >
        <div className="pb-4 px-4">
          <h2 className="text-xl font-semibold mb-4">
            Delete Folder "{folder.folder_name}"
          </h2>
          <p className="mb-4">Are you sure you want to delete this folder?</p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </SlideOverModal>
    </div>
  );
}
