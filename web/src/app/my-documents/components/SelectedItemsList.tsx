import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { UserFolder, UserFile } from "./types";

interface SelectedItemsListProps {
  uploadedFiles: File[];
  selectedItems: { files: number[]; folders: number[] };
  allFolders: UserFolder[];
  allFiles: UserFile[];
  onRemove: (type: "file" | "folder", id: number) => void;
  onRemoveUploadedFile: (name: string) => void;
  links: string[];
}

export const SelectedItemsList: React.FC<SelectedItemsListProps> = ({
  links,
  uploadedFiles,
  selectedItems,
  allFolders,
  allFiles,
  onRemove,
  onRemoveUploadedFile,
}) => {
  const selectedFolders = allFolders.filter((folder) =>
    selectedItems.folders.includes(folder.id)
  );
  const selectedFiles = allFiles.filter((file) =>
    selectedItems.files.includes(file.id)
  );

  return (
    <div className="h-full w-full flex flex-col">
      <h3 className="font-semibold mb-2">Selected Items</h3>
      <div className="w-full overflow-y-auto border-t  border-t-text-subtle flex-grow">
        <div className="space-y-2">
          {links.map((link: string) => (
            <div
              key={link}
              className="flex  w-full items-center justify-between bg-gray-100 p-1.5 rounded"
            >
              <span className="text-sm">{link}</span>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {uploadedFiles.map((file) => (
            <div
              key={file.name}
              className="flex  w-full items-center justify-between bg-gray-100 p-1.5 rounded"
            >
              <span className="text-sm">
                {file.name}{" "}
                <span className="text-xs w-full truncate text-gray-500">
                  (uploaded)
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveUploadedFile(file.name)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {selectedFolders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between bg-gray-100 p-2 rounded"
            >
              <span className="text-sm">{folder.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove("folder", folder.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {selectedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-gray-100 p-2 rounded"
            >
              <span className="w-full truncate text-sm">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove("file", file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
