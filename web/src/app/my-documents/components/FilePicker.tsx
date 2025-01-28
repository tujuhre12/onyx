import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import { Grid, List, UploadIcon } from "lucide-react";
import { FolderTreeItem } from "./FolderTreeItem";
import { FileListItem } from "./FileListItem";
import { Breadcrumb } from "./Breadcrumb";
import { SelectedItemsList } from "./SelectedItemsList";
import {
  FolderNode,
  UserFolder,
  UserFile,
  FilePickerModalProps,
} from "./types";
import { Separator } from "@/components/ui/separator";

const ListIcon = () => <List className="h-4 w-4" />;
const GridIcon = () => <Grid className="h-4 w-4" />;

const IconButton: React.FC<{
  icon: React.ComponentType;
  onClick: () => void;
  active: boolean;
}> = ({ icon: Icon, onClick, active }) => (
  <button
    className={`p-2 flex-none h-10 w-10 flex items-center justify-center rounded ${
      active ? "bg-gray-200" : "hover:bg-gray-100"
    }`}
    onClick={onClick}
  >
    <Icon />
  </button>
);

function buildTree(folders: UserFolder[], files: UserFile[]): FolderNode {
  const folderMap: { [key: number]: FolderNode } = {};
  const rootNode: FolderNode = {
    id: 0,
    name: "Root",
    parent_id: null,
    children: [],
    files: [],
  };

  folders.forEach((folder) => {
    folderMap[folder.id] = { ...folder, children: [], files: [] };
  });

  files.forEach((file) => {
    if (file.parent_folder_id === null) {
      rootNode.files.push(file);
    } else if (folderMap[file.parent_folder_id]) {
      folderMap[file.parent_folder_id].files.push(file);
    }
  });

  folders.forEach((folder) => {
    if (folder.parent_id === null) {
      rootNode.children.push(folderMap[folder.id]);
    } else if (folderMap[folder.parent_id]) {
      folderMap[folder.parent_id].children.push(folderMap[folder.id]);
    }
  });

  return rootNode;
}

export const FilePickerModal: React.FC<FilePickerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  buttonContent,
}) => {
  const [allFolders, setAllFolders] = useState<UserFolder[]>([]);
  const [allFiles, setAllFiles] = useState<UserFile[]>([]);
  const [fileSystem, setFileSystem] = useState<FolderNode | null>(null);
  const [currentFolder, setCurrentFolder] = useState<FolderNode | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);

  const [selectedItems, setSelectedItems] = useState<{
    files: number[];
    folders: number[];
  }>({ files: [], folders: [] });
  const [view, setView] = useState<"grid" | "list">("list");

  useEffect(() => {
    const loadFileSystem = async () => {
      const res = await fetch("/api/user/file-system");
      const data = await res.json();
      const folders = data.folders.map((f: any) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parent_id,
      }));
      const files = data.files.map((f: any) => ({
        id: f.id,
        name: f.name,
        parent_folder_id: f.parent_folder_id,
      }));

      setAllFolders(folders);
      setAllFiles(files);

      const tree = buildTree(folders, files);
      setFileSystem(tree);
      setCurrentFolder(tree);
    };
    if (isOpen) {
      loadFileSystem();
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave(selectedItems);
    onClose();
  };

  const handleRemoveSelectedItem = (type: "file" | "folder", id: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [type === "file" ? "files" : "folders"]: prev[
        type === "file" ? "files" : "folders"
      ].filter((itemId) => itemId !== id),
    }));
  };

  const handleRemoveUploadedFile = (name: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.name !== name));
  };

  const handleFolderClick = (folder: FolderNode) => {
    setCurrentFolder(folder);
  };

  const handleFileSelect = (fileId: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      files: prev.files.includes(fileId)
        ? prev.files.filter((id) => id !== fileId)
        : [...prev.files, fileId],
    }));
  };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedFiles((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const calculateTokens = () => {
    // This is a placeholder calculation. Replace with actual token calculation logic.
    return selectedItems.files.length * 10 + selectedItems.folders.length * 50;
  };

  if (!fileSystem || !currentFolder) return null;

  return (
    <Modal
      hideDividerForTitle
      onOutsideClick={onClose}
      className="max-w-4xl flex flex-col w-full !overflow-hidden h-[70vh]"
      title={title}
    >
      <div className="flex w-full items-center flex-col h-full">
        <div className="grid  h-full grid-cols-2 overflow-y-hidden w-full">
          <div className="w-full pb-4 px-4 border-r overflow-y-auto">
            <div className="mb-4 justify-between flex gap-x-2 w-full">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-text-dark"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex space-x-2">
                <IconButton
                  icon={ListIcon}
                  onClick={() => setView("list")}
                  active={view === "list"}
                />
                <IconButton
                  icon={GridIcon}
                  onClick={() => setView("grid")}
                  active={view === "grid"}
                />
              </div>
            </div>

            <div className="flex-grow overflow-y-auto">
              <div
                className={`${view === "grid" ? "grid grid-cols-4 gap-4" : ""}`}
              >
                {currentFolder.children.map((folder) => (
                  <div
                    key={folder.id}
                    className={` ${
                      view === "grid"
                        ? "flex flex-col items-center"
                        : "flex items-center"
                    }`}
                    onClick={() => handleFolderClick(folder)}
                  >
                    <FolderTreeItem
                      node={folder}
                      selectedItems={selectedItems}
                      setSelectedItems={setSelectedItems}
                      setCurrentFolder={setCurrentFolder}
                      depth={0}
                      view={view}
                    />
                  </div>
                ))}

                {currentFolder.files.map((file) => (
                  <FileListItem
                    key={file.id}
                    file={file}
                    isSelected={selectedItems.files.includes(file.id)}
                    onSelect={() => handleFileSelect(file.id)}
                    view={view}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* NOTE: update */}
          <div className="w-full px-4 pb-4   m-2 flex flex-col h-[520px] ">
            <div className="shrink flex h-full overflow-y-auto mb-1 ">
              <SelectedItemsList
                links={links}
                selectedItems={selectedItems}
                allFolders={allFolders}
                allFiles={allFiles}
                uploadedFiles={uploadedFiles}
                onRemove={handleRemoveSelectedItem}
                onRemoveUploadedFile={handleRemoveUploadedFile}
              />
            </div>

            <div className="flex flex-col">
              <div className="p-4  flex-none border rounded-lg bg-neutral-50">
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex items-center justify-center space-x-2"
                >
                  <UploadIcon className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Upload files
                  </span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              <Separator className="my-2" />

              <div className="flex flex-col">
                <div className="flex flex-col gap-y-2">
                  <p className="text-sm text-text-subtle">
                    Add links to the context
                  </p>
                </div>
                <form
                  className="flex gap-x-4 mt-2"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="w-full gap-x-2 flex">
                    <input
                      type="url"
                      placeholder="Enter URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      onChange={(e) => {
                        // Handle URL input change
                        console.log(e.target.value);
                        // You might want to add state to store this value
                      }}
                    />
                    <Button
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.form?.querySelector(
                          'input[type="url"]'
                        ) as HTMLInputElement;
                        if (input && input.value) {
                          setLinks((prevLinks) => [...prevLinks, input.value]);
                          input.value = "";
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4  flex-col w-full flex   border-t mt-auto  items-center justify-between">
          <div className="mb-4 font-medium text-lg text-text-dark">
            Total tokens: {calculateTokens()}
          </div>
          <div className="flex justify-center">
            <Button
              className="text-lg"
              size="lg"
              onClick={handleSave}
              variant="default"
            >
              {buttonContent}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
