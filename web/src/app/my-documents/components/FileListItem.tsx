import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

import { File as FileIcon } from "lucide-react";
import { UserFile } from "./types";

interface FileListItemProps {
  file: UserFile;
  isSelected: boolean;
  onSelect: () => void;
  view: "grid" | "list";
}

export const FileListItem: React.FC<FileListItemProps> = ({
  file,
  isSelected,
  onSelect,
  view,
}) => {
  return (
    <div
      className={`p-2 s${
        view === "grid"
          ? "flex flex-col items-center"
          : "flex items-center  hover:bg-gray-100 rounded cursor-pointer"
      }`}
      onClick={onSelect}
    >
      <div
        className={`flex w-full items-center ${
          view === "grid" ? "flex-col" : ""
        }`}
      >
        <Checkbox
          checked={isSelected}
          className={view === "grid" ? "ml-4 mb-2" : "mr-2"}
        />
        <FileIcon
          className={`${
            view === "grid" ? "h-12 w-12 mb-2" : "h-5 w-5 mr-2"
          } text-gray-500`}
        />
        <span
          className={`max-w-full text-sm truncate ${
            view === "grid" ? "text-center" : ""
          }`}
        >
          {file.name}
        </span>
      </div>
    </div>
  );
};
