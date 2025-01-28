"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Grid, List, Plus, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePopup } from "@/components/admin/connectors/Popup";
import { FolderActions } from "./FolderActions";
import { FolderContents } from "./FolderContents";
import TextView from "@/components/chat_search/TextView";
import { PageSelector } from "@/components/PageSelector";
import { MinimalOnyxDocument } from "@/lib/search/interfaces";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface FolderResponse {
  id: number;
  name: string;
  description: string;
}

interface FileResponse {
  id: number;
  name: string;
  document_id: string;
  folder_id: number | null;
}

interface FolderContentsResponse {
  folders: FolderResponse[];
  files: FileResponse[];
}

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

const CreateFolderPopover: React.FC<{
  onCreateFolder: (name: string, description: string) => void;
}> = ({ onCreateFolder }) => {
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (folderName.trim()) {
      onCreateFolder(folderName.trim(), folderDescription.trim());
      setFolderName("");
      setFolderDescription("");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="inline-flex items-center justify-center relative shrink-0 h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap pl-2 pr-3 gap-1">
          <Plus className="h-5 w-5" />
          Create Folder
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="w-full space-y-2">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              className="w-full"
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              required
            />
          </div>
          <div className="w-full space-y-2">
            <Label htmlFor="folderDescription">Description (optional)</Label>
            <Input
              className="w-full"
              id="folderDescription"
              value={folderDescription}
              onChange={(e) => setFolderDescription(e.target.value)}
              placeholder="Enter folder description"
            />
          </div>
          <Button type="submit">Create Folder</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
};

export default function MyDocuments() {
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [folderContents, setFolderContents] =
    useState<FolderContentsResponse | null>(null);
  const [folders, setFolders] = useState<FolderResponse[]>([]);

  const [page, setPage] = useState<number>(1);

  const pageLimit = 10;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { popup, setPopup } = usePopup();

  const [presentingDocument, setPresentingDocument] =
    useState<MinimalOnyxDocument | null>(null);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const folderIdFromParams = parseInt(searchParams.get("folder") || "0", 10);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch("/api/user/folder");
      if (!response.ok) {
        throw new Error("Failed to fetch folders");
      }
      const data = await response.json();
      setFolders(data);
    } catch (error) {
      console.error("Error fetching folders:", error);
      setPopup({
        message: "Failed to fetch folders",
        type: "error",
      });
    }
  }, []);

  const fetchFolderContents = useCallback(
    async (folderId: number | null) => {
      try {
        const response = await fetch(
          `/api/user/file-system?page=${page}&folder_id=${folderId || ""}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch folder contents");
        }
        const data = await response.json();
        setFolderContents(data);
      } catch (error) {
        console.error("Error fetching folder contents:", error);
        setPopup({
          message: "Failed to fetch folder contents",
          type: "error",
        });
      }
    },
    [page]
  );

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    setCurrentFolder(folderIdFromParams || null);
    fetchFolderContents(folderIdFromParams || null);
  }, [folderIdFromParams, fetchFolderContents]);

  const refreshFolderContents = useCallback(() => {
    fetchFolderContents(currentFolder);
  }, [fetchFolderContents, currentFolder]);

  const handleFolderClick = (id: number) => {
    router.push(`/my-documents?folder=${id}`);
    setPage(1);
  };

  const handleCreateFolder = useCallback(
    async (name: string, description: string) => {
      try {
        const response = await fetch("/api/user/folder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description }),
        });
        if (response.ok) {
          fetchFolders();
          refreshFolderContents();
          setPopup({
            message: "Folder created successfully",
            type: "success",
          });
        } else {
          throw new Error("Failed to create folder");
        }
      } catch (error) {
        console.error("Error creating folder:", error);
        setPopup({
          message: "Failed to create folder",
          type: "error",
        });
      }
    },
    [fetchFolders, refreshFolderContents, setPopup]
  );

  const handleUploadFiles = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append("files", files[i]);
        }
        formData.append(
          "folder_id",
          currentFolder ? currentFolder.toString() : ""
        );

        try {
          const response = await fetch("/api/user/file/upload", {
            method: "POST",
            body: formData,
          });
          if (response.ok) {
            refreshFolderContents();
            setPopup({
              message: "Files uploaded successfully",
              type: "success",
            });
          } else {
            throw new Error("Failed to upload files");
          }
        } catch (error) {
          console.error("Error uploading files:", error);
          setPopup({
            message: "Failed to upload files",
            type: "error",
          });
        }

        setPage(1);
      }
    },
    [currentFolder, refreshFolderContents, setPopup, setPage]
  );

  const handleDeleteItem = async (itemId: number, isFolder: boolean) => {
    try {
      const endpoint = isFolder
        ? `/api/user/folder/${itemId}`
        : `/api/user/file/${itemId}`;
      const response = await fetch(endpoint, {
        method: "DELETE",
      });
      if (response.ok) {
        if (isFolder) {
          fetchFolders();
        }
        refreshFolderContents();
        setPopup({
          message: `${isFolder ? "Folder" : "File"} deleted successfully`,
          type: "success",
        });
      } else {
        throw new Error(`Failed to delete ${isFolder ? "folder" : "file"}`);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      setPopup({
        message: `Failed to delete ${isFolder ? "folder" : "file"}`,
        type: "error",
      });
    }
  };

  const handleMoveItem = async (
    itemId: number,
    destinationFolderId: number | null,
    isFolder: boolean
  ) => {
    const endpoint = isFolder
      ? `/api/user/folder/${itemId}/move`
      : `/api/user/file/${itemId}/move`;
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          new_folder_id: destinationFolderId,
          [isFolder ? "folder_id" : "file_id"]: itemId,
        }),
      });
      if (response.ok) {
        refreshFolderContents();
        setPopup({
          message: `${isFolder ? "Folder" : "File"} moved successfully`,
          type: "success",
        });
      } else {
        throw new Error("Failed to move item");
      }
    } catch (error) {
      console.error("Error moving item:", error);
      setPopup({
        message: "Failed to move item",
        type: "error",
      });
    }
  };

  const handleDownloadItem = async (documentId: string) => {
    try {
      const response = await fetch(
        `/api/chat/file/${encodeURIComponent(documentId)}`,
        {
          method: "GET",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch file");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get("Content-Disposition");
      const fileName = contentDisposition
        ? contentDisposition.split("filename=")[1]
        : "document";

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      setPopup({
        message: "Failed to download file",
        type: "error",
      });
    }
  };

  const onRenameItem = async (
    itemId: number,
    newName: string,
    isFolder: boolean
  ) => {
    const endpoint = isFolder
      ? `/api/user/folder/${itemId}?name=${encodeURIComponent(newName)}`
      : `/api/user/file/${itemId}/rename?name=${encodeURIComponent(newName)}`;
    try {
      const response = await fetch(endpoint, {
        method: "PUT",
      });
      if (response.ok) {
        if (isFolder) {
          fetchFolders();
        }
        refreshFolderContents();
        setPopup({
          message: `${isFolder ? "Folder" : "File"} renamed successfully`,
          type: "success",
        });
      } else {
        throw new Error("Failed to rename item");
      }
    } catch (error) {
      console.error("Error renaming item:", error);
      setPopup({
        message: `Failed to rename ${isFolder ? "folder" : "file"}`,
        type: "error",
      });
    }
  };

  return (
    <div className="min-h-full w-full min-w-0 flex-1">
      <header className="flex bg-background w-full items-center justify-between gap-4 pl-11 pr-3 pt-2 md:pl-8 -translate-y-px">
        <h1 className=" flex items-center gap-1.5 text-lg font-medium leading-tight tracking-tight max-md:hidden">
          <Grid className="h-5 w-5" />
          My Documents
        </h1>
        <div className="flex items-center gap-2">
          <Button
            className="inline-flex items-center justify-center relative shrink-0 h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap pl-2 pr-3 gap-1"
            onClick={refreshFolderContents}
          >
            <RefreshCw className="h-5 w-5" />
            Refresh
          </Button>
          <CreateFolderPopover onCreateFolder={handleCreateFolder} />
          <label className="inline-flex items-center justify-center relative shrink-0 h-9 px-4 py-2 rounded-lg min-w-[5rem] active:scale-[0.985] whitespace-nowrap pl-2 pr-3 gap-1 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
            <Upload className="h-5 w-5" />
            Upload Files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleUploadFiles}
            />
          </label>
        </div>
      </header>
      <main className="mx-auto mt-4 w-full max-w-7xl flex-1 px-4 pb-20 md:pl-8 lg:mt-6 md:pr-8 2xl:pr-14">
        <div className=" top-3 z-[5] flex gap-4 bg-gradient-to-b via-50% max-lg:flex-col lg:sticky lg:items-center">
          <div className="w-full md:max-w-96">
            <div className="bg-background-000 border border-border-200 hover:border-border-100 transition-colors placeholder:text-text-500 focus:border-accent-secondary-100 focus-within:!border-accent-secondary-100 focus:ring-0 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 h-11 px-3 rounded-[0.6rem] w-full inline-flex cursor-text items-stretch gap-2">
              <div className="flex items-center">
                <Search className="h-4 w-4 text-text-400" />
              </div>
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full placeholder:text-text-500 m-0 bg-transparent p-0 focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <div className="flex-1 items-center gap-3 md:flex lg:justify-end">
            <div className="flex items-center gap-0.5 max-md:mb-3">
              <IconButton
                icon={List}
                onClick={() => setView("list")}
                active={view === "list"}
              />
              <IconButton
                icon={Grid}
                onClick={() => setView("grid")}
                active={view === "grid"}
              />
            </div>
          </div>
        </div>
        {presentingDocument && (
          <TextView
            presentingDocument={presentingDocument}
            onClose={() => setPresentingDocument(null)}
          />
        )}
        {popup}
        <div className="flex-grow">
          {folderContents ? (
            folderContents.folders.length > 0 ||
            folderContents.files.length > 0 ? (
              <div
                className={`mt-4 grid gap-3 md:mt-8 ${
                  view === "grid" ? "md:grid-cols-2" : ""
                } md:gap-6`}
              >
                {folderContents.folders.map((folder) => (
                  <a
                    key={folder.id}
                    className={`from-[#F9F8F4]/80 to-[#F7F6F0] border-0.5 border-border hover:from-[#F9F8F4] hover:to-[#F7F6F0] hover:border-border-200 text-md group relative flex cursor-pointer ${
                      view === "list" ? "flex-row items-center" : "flex-col"
                    } overflow-x-hidden text-ellipsis rounded-xl bg-gradient-to-b py-4 pl-5 pr-4 transition-all ease-in-out hover:shadow-sm active:scale-[0.98]`}
                    href={`/my-documents?folder=${folder.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleFolderClick(folder.id);
                    }}
                  >
                    <div
                      className={`flex ${
                        view === "list" ? "flex-row items-center" : "flex-col"
                      } flex-1`}
                    >
                      <div className="font-tiempos flex items-center">
                        <Grid className="h-5 w-5 mr-2 text-yellow-500" />
                        <span className="text-truncate inline-block max-w-md">
                          {folder.name}
                        </span>
                      </div>
                      <div
                        className={`text-text-400 ${
                          view === "list" ? "ml-4" : "mt-1"
                        } line-clamp-2 text-xs`}
                      >
                        {folder.description}
                      </div>
                    </div>
                    <div className="text-text-500 mt-3 flex justify-between text-xs">
                      &nbsp;
                      <span>
                        Updated <span data-state="closed">5 months ago</span>
                      </span>
                    </div>
                  </a>
                ))}
                {folderContents.files.map((file) => (
                  <a
                    key={file.id}
                    className={`from-background-100 to-background-100/30 border-0.5 border-border-300 hover:from-background-000 hover:to-background-000/80 hover:border-border-200 text-md group relative flex cursor-pointer ${
                      view === "list" ? "flex-row items-center" : "flex-col"
                    } overflow-x-hidden text-ellipsis rounded-xl bg-gradient-to-b py-4 pl-5 pr-4 transition-all ease-in-out hover:shadow-sm active:scale-[0.98]`}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPresentingDocument({
                        document_id: file.document_id,
                        semantic_identifier: file.name,
                      });
                    }}
                  >
                    <div
                      className={`flex ${
                        view === "list" ? "flex-row items-center" : "flex-col"
                      } flex-1`}
                    >
                      <div className="font-tiempos flex items-center">
                        <List className="h-5 w-5 mr-2 text-blue-500" />
                        <span className="text-truncate inline-block max-w-md">
                          {file.name}
                        </span>
                      </div>
                      <div
                        className={`text-text-300 ${
                          view === "list" ? "ml-4" : "mt-1"
                        } line-clamp-2 text-xs`}
                      >
                        Document ID: {file.document_id}
                      </div>
                    </div>
                    <div className="text-text-500 mt-3 flex justify-between text-xs">
                      &nbsp;
                      <span>
                        Updated <span data-state="closed">5 months ago</span>
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p>No content in this folder</p>
            )
          ) : (
            <p>Loading...</p>
          )}
          <div className="mt-3 flex">
            <div className="mx-auto">
              <PageSelector
                currentPage={page}
                totalPages={Math.ceil(
                  ((folderContents?.files?.length || 0) +
                    (folderContents?.folders?.length || 0)) /
                    pageLimit
                )}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  window.scrollTo({
                    top: 0,
                    left: 0,
                    behavior: "smooth",
                  });
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
