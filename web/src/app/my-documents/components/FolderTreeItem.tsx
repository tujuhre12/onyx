import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Folder as FolderIcon } from "lucide-react";
import { FolderNode } from "./types";

interface FolderTreeItemProps {
  node: FolderNode;
  selectedItems: { files: number[]; folders: number[] };
  setSelectedItems: React.Dispatch<
    React.SetStateAction<{ files: number[]; folders: number[] }>
  >;
  setCurrentFolder: React.Dispatch<React.SetStateAction<FolderNode | null>>;
  depth: number;
  view: "grid" | "list";
}

export const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  node,
  selectedItems,
  setSelectedItems,
  setCurrentFolder,
  depth,
  view,
}) => {
  const isFolderSelected = selectedItems.folders.includes(node.id);

  const handleFolderSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItems((prev) => ({
      ...prev,
      folders: isFolderSelected
        ? prev.folders.filter((id) => id !== node.id)
        : [...prev.folders, node.id],
    }));
  };

  return (
    <div
      className={` p-2 w-full ${
        view === "grid"
          ? "flex flex-col rounded items-center"
          : "flex items-center hover:bg-gray-100 rounded-gl cursor-pointer"
      }`}
      onClick={() => setCurrentFolder(node)}
    >
      <div
        className={`flex overflow-hidden w-full items-center ${
          view === "grid" ? "flex-col" : ""
        }`}
      >
        <Checkbox
          checked={isFolderSelected}
          onCheckedChange={() => {}}
          onClick={handleFolderSelect}
          className={view === "grid" ? "my-1" : "mr-2"}
        />
        <FolderIcon
          className={`${
            view === "grid" ? "h-12 w-12 mb-2" : "h-5 w-5 mr-2"
          } text-blue-500`}
        />
        <span
          className={`max-w-full text-sm truncate ${
            view === "grid" ? "text-center" : ""
          }`}
        >
          {node.name}
        </span>
      </div>
    </div>
  );
};
