"use client";

import React, { useState } from "react";
import { ChatState } from "@/app/chat/types";
import { LlmManager, useLlmManager, useFilters } from "@/lib/hooks";
import { OnyxLogoTypeIcon } from "@/components/icons/icons";
import SearchInputBar from "@/components-2/SearchBar";
import { useChatContext } from "@/components/context/ChatContext";
import { SavedSearchDoc } from "./interfaces";
import SearchResultItem from "@/components-2/SearchResultItem";
import { listSourceMetadata } from "@/lib/sources";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { FiX } from "react-icons/fi";

type PageProps = {
  searchParams: Promise<{ [key: string]: string }>;
};

export default function Page(props: PageProps) {
  const [message, setMessage] = useState("");
  const [chatState, setChatState] = useState<ChatState>("input");
  const [searchResults, setSearchResults] = useState<SavedSearchDoc[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<string | null>(
    null
  );

  const { llmProviders } = useChatContext();
  const llmManager: LlmManager = useLlmManager(llmProviders);
  const filterManager = useFilters();

  const handleSubmit = async () => {
    if (!message.trim()) {
      return;
    }

    setChatState("loading");
    setSearchResults([]);

    try {
      const response = await fetch("/api/search/send-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: message.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Search request failed: ${response.statusText}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body available");
      }

      setChatState("streaming");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.error) {
                console.error("Search error:", data.error);
                setChatState("input");
                return;
              }

              // Cast the data to SavedSearchDoc and add to results
              const searchDoc = data as SavedSearchDoc;
              setSearchResults((prev) => [...prev, searchDoc]);
              console.log("Search result:", searchDoc);
            } catch (e) {
              console.warn("Failed to parse streaming data:", line);
            }
          }
        }
      }

      setChatState("input");
    } catch (error) {
      console.error("Search submission error:", error);
      setChatState("input");
    }
  };

  const handleStopGenerating = () => {
    setChatState("input");
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background">
      <div className="w-full px-4 flex flex-col items-center justify-center h-full overflow-y-scroll">
        {/* Onyx Logo */}
        <div className="flex justify-center pb-8 flex-shrink-0">
          <OnyxLogoTypeIcon size={200} />
        </div>

        {/* Search Bar */}
        <div className="w-full max-w-2xl flex-shrink-0">
          <SearchInputBar
            message={message}
            setMessage={setMessage}
            stopGenerating={handleStopGenerating}
            onSubmit={handleSubmit}
            llmManager={llmManager}
            chatState={chatState}
            filterManager={filterManager}
            availableSources={[]}
            availableDocumentSets={[]}
            availableTags={[]}
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="w-full max-w-3xl pt-4 flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col py-3 gap-y-2 flex-shrink-0">
              {/* Title */}
              <h2 className="px-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Search Results ({searchResults.length})
              </h2>

              {/* Filter Buttons */}
              <div className="px-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Source Type Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="py-2 px-3 text-sm text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2">
                        {selectedSourceType ? (
                          <>
                            {listSourceMetadata().find(
                              (s) => s.internalName === selectedSourceType
                            )?.icon &&
                              React.createElement(
                                listSourceMetadata().find(
                                  (s) => s.internalName === selectedSourceType
                                )!.icon,
                                { size: 16 }
                              )}
                            {listSourceMetadata().find(
                              (s) => s.internalName === selectedSourceType
                            )?.displayName || "All Sources"}
                          </>
                        ) : (
                          "All Sources"
                        )}
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => setSelectedSourceType(null)}
                        className="p-3"
                      >
                        All Sources
                      </DropdownMenuItem>
                      {Array.from(
                        new Set(searchResults.map((doc) => doc.source_type))
                      )
                        .map((sourceType) => {
                          const sourceMetadata = listSourceMetadata().find(
                            (s) => s.internalName === sourceType
                          );
                          return sourceMetadata ? (
                            <DropdownMenuItem
                              key={sourceType}
                              onClick={() => setSelectedSourceType(sourceType)}
                              className="p-3"
                            >
                              <sourceMetadata.icon size={16} className="mr-2" />
                              {sourceMetadata.displayName}
                            </DropdownMenuItem>
                          ) : null;
                        })
                        .filter(Boolean)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Clear Button */}
                <button
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  onClick={() => setSelectedSourceType(null)}
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* Border */}
            <div className="border-t border-neutral-600 pb-2 flex-shrink-0" />

            <div className="flex-1">
              {searchResults
                .filter(
                  (doc) =>
                    !selectedSourceType ||
                    doc.source_type === selectedSourceType
                )
                .map((doc, index) => (
                  <div key={index}>
                    <SearchResultItem
                      doc={doc}
                      onClick={() => {
                        if (doc.link) {
                          window.open(doc.link, "_blank");
                        }
                      }}
                    />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
