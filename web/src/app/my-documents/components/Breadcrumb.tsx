import React from "react";
import { ChevronRight } from "lucide-react";
import { FolderNode } from "./types";
interface BreadcrumbProps {
  currentFolder: FolderNode | null;
  setCurrentFolder: React.Dispatch<React.SetStateAction<FolderNode | null>>;
  rootFolder: FolderNode;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentFolder,
  setCurrentFolder,
  rootFolder,
}) => {
  const breadcrumbs = [];
  let folder: FolderNode | null = currentFolder;

  while (folder) {
    breadcrumbs.unshift(folder);
    folder = folder.parent_id
      ? findFolderById(rootFolder, folder.parent_id)
      : null;
  }

  return (
    <div className="flex items-center text-sm">
      <span
        className="cursor-pointer hover:underline"
        onClick={() => setCurrentFolder(rootFolder)}
      >
        Root
      </span>
      {breadcrumbs.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <ChevronRight className="mx-1 h-4 w-4 text-gray-400" />
          <span
            className="cursor-pointer hover:underline"
            onClick={() => setCurrentFolder(folder)}
          >
            {folder.name}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};

function findFolderById(root: FolderNode, id: number): FolderNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findFolderById(child, id);
    if (found) return found;
  }
  return null;
}
