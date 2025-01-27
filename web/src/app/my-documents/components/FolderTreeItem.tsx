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
    <a
      className="from-[#F9F8F2] border border-border w-full to-[#F9F8F2]/30 border-0.5 border-border-300 hover:from-[#F9F8F2] hover:to-[#F9F8F2]/80 hover:border-border-200 text-md group relative flex cursor-pointer flex-col overflow-x-hidden text-ellipsis rounded-xl bg-gradient-to-b py-3 pl-5 pr-4 transition-all ease-in-out hover:shadow-sm "
      onClick={() => setCurrentFolder(node)}
    >
      <div className="flex flex-1 flex-col">
        <div className="flex">
          <span className="text-truncate text-text-dark inline-block max-w-md">
            {node.name}
          </span>
        </div>
        <div className="text-text-500 mt-1 line-clamp-2 text-xs">
          This folder contains 1000 files and describes the state of the company
          {/* Add folder description or other details here */}
        </div>
      </div>
      <div className="text-text-500 mt-1 flex justify-between text-xs">
        &nbsp;
        <span>
          Updated <span data-state="closed">47 minutes ago</span>
        </span>
      </div>
    </a>
  );
};

{
  /* Original implementation commented out
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
    */
}
