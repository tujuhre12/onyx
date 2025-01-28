import React, { useState } from "react";
import { MoveFileModal } from "./MoveFileModal";
import { FileItem, FolderItem } from "./MyDocumenItem";

interface FolderType {
  id: number;
  name: string;
}

interface FileType extends FolderType {
  document_id: string;
  folder_id: number | null;
}

interface FolderContentsProps {
  pageLimit: number;
  currentPage: number;
  contents: {
    folders: FolderType[];
    files: FileType[];
  };
  onFolderClick: (folderId: number) => void;
  currentFolder: number | null;
  onDeleteItem: (itemId: number, isFolder: boolean) => void;
  onDownloadItem: (documentId: string) => void;
  onMoveItem: (
    itemId: number,
    destinationFolderId: number | null,
    isFolder: boolean
  ) => void;
  setPresentingDocument: (
    document_id: string,
    semantic_identifier: string
  ) => void;
  onRenameItem: (itemId: number, newName: string, isFolder: boolean) => void;
  folders: FolderType[];
}

export function FolderContents({
  pageLimit,
  currentPage,
  setPresentingDocument,
  contents,
  onFolderClick,
  currentFolder,
  onDeleteItem,
  onDownloadItem,
  onMoveItem,
  onRenameItem,
  folders,
}: FolderContentsProps) {
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [itemToMove, setItemToMove] = useState<{
    id: number;
    name: string;
    isFolder: boolean;
  } | null>(null);

  const [editingItem, setEditingItem] = useState<{
    id: number;
    name: string;
    isFolder: boolean;
  } | null>(null);

  const handleMove = (destinationFolderId: number | null) => {
    if (itemToMove) {
      onMoveItem(itemToMove.id, destinationFolderId, itemToMove.isFolder);
      setIsMoveModalOpen(false);
      setItemToMove(null);
    }
  };

  const handleRename = (itemId: number, newName: string, isFolder: boolean) => {
    onRenameItem(itemId, newName, isFolder);
    setEditingItem(null);
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    item: { id: number; isFolder: boolean; name: string }
  ) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    targetFolderId: number
  ) => {
    e.preventDefault();
    const item = JSON.parse(e.dataTransfer.getData("application/json"));
    if (item && typeof item.id === "number") {
      onMoveItem(item.id, targetFolderId, item.isFolder);
    }
  };

  const startIndex = pageLimit * (currentPage - 1);
  const endIndex = startIndex + pageLimit;
  const itemsToDisplay = [...contents.folders, ...contents.files].slice(
    startIndex,
    endIndex
  );

  return (
    <div className="flex-grow" onDragOver={(e) => e.preventDefault()}>
      {itemsToDisplay.map((item) => {
        if ("document_id" in item) {
          return (
            <FileItem
              key={item.id}
              file={{
                name: item.name,
                id: item.id,
                document_id: item.document_id as string,
              }}
              setPresentingDocument={setPresentingDocument}
              onDeleteItem={onDeleteItem}
              onDownloadItem={onDownloadItem}
              onMoveItem={(id) => {
                setItemToMove({ id, name: item.name, isFolder: false });
                setIsMoveModalOpen(true);
              }}
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              handleRename={handleRename}
              onDragStart={handleDragStart}
            />
          );
        } else {
          return (
            <FolderItem
              key={item.id}
              folder={item}
              onFolderClick={onFolderClick}
              onDeleteItem={onDeleteItem}
              onMoveItem={(id) => {
                setItemToMove({ id, name: item.name, isFolder: true });
                setIsMoveModalOpen(true);
              }}
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              handleRename={handleRename}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
            />
          );
        }
      })}

      {itemToMove && (
        <MoveFileModal
          isOpen={isMoveModalOpen}
          onClose={() => setIsMoveModalOpen(false)}
          onMove={handleMove}
          fileName={itemToMove.name}
          currentFolderId={currentFolder}
        />
      )}
    </div>
  );
}
