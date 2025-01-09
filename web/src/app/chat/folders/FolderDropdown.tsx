import React, { useState, useRef, useEffect } from "react";
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

interface FolderDropdownProps {
  folder:
    | Folder
    | {
        folder_name: "Chats";
        chat_sessions: ChatSession[];
        folder_id?: "chats";
      };
  currentChatId?: string;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  closeSidebar?: () => void;
  onEdit?: (folderId: number | "chats", newName: string) => void;
  onDelete?: (folderId: number | "chats") => void;
}

export const FolderDropdown: React.FC<FolderDropdownProps> = ({
  folder,
  currentChatId,
  showShareModal,
  showDeleteModal,
  closeSidebar,
  onEdit,
  onDelete,
}) => {
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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (onEdit && folder.folder_id) {
      onEdit(folder.folder_id, newFolderName);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNewFolderName(folder.folder_name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete && folder.folder_id) {
      onDelete(folder.folder_id);
    }
  };

  return (
    <div className="mb-2">
      <div
        className="flex items-center w-full text-[#6c6c6c] rounded-md p-1 relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          className="flex items-center flex-grow"
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
              className="text-sm font-medium bg-transparent border-none outline-none"
            />
          ) : (
            <div className="flex items-center">
              <span className="text-sm font-medium">{folder.folder_name}</span>
              {isHovered && folder.folder_id !== "chats" && (
                <button onClick={handleEdit} className="ml-1 p-1">
                  <FiEdit size={14} />
                </button>
              )}
            </div>
          )}
        </button>
        {isHovered && !isEditing && folder.folder_id !== "chats" && (
          <button onClick={handleDelete} className="p-1 ml-auto">
            <FiTrash2 size={14} />
          </button>
        )}
        {isEditing && (
          <>
            <button onClick={handleSave} className="p-1 text-green-500">
              <FiCheck size={14} />
            </button>
            <button onClick={handleCancel} className="p-1 text-red-500">
              <FiX size={14} />
            </button>
          </>
        )}
      </div>
      {isOpen && (
        <div className="mr-4 ml-1 mt-1">
          {folder.chat_sessions.map((chat) => (
            <ChatSessionDisplay
              key={chat.id}
              chatSession={chat}
              isSelected={currentChatId === chat.id}
              showShareModal={showShareModal}
              showDeleteModal={showDeleteModal}
              closeSidebar={closeSidebar}
            />
          ))}
        </div>
      )}
    </div>
  );
};
