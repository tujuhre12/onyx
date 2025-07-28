"use client";

import React, { useRef, useState } from "react";
import { useLlmManager } from "@/lib/hooks";
import { OnyxLogoTypeIcon } from "@/components/icons/icons";
import SearchInputBar from "@/components-2/Search/SearchInputBar";
import SearchSuggestions from "@/components-2/Search/SearchSuggestions";
import { useChatContext } from "@/components/context/ChatContext";
import { SavedSearchDoc } from "./interfaces";
import SearchResultItem from "@/components-2/Search/SearchResultItem";
import { Separator } from "@/components/ui/separator";

type PageProps = {
  searchParams: Promise<{ [key: string]: string }>;
};

export default function Page({}: PageProps) {
  const [searchResults, setSearchResults] = useState<SavedSearchDoc[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { llmProviders } = useChatContext();
  const llmManager = useLlmManager(llmProviders);

  const handleSubmit = async () => {
    if (!searchInputRef.current) {
      return;
    }

    const message = searchInputRef.current.value;

    setSearchResults([]);

    try {
      const llm_override =
        llmManager.currentLlm.modelName || llmManager.temperature
          ? {
              temperature: llmManager.temperature,
              model_provider: llmManager.currentLlm.provider,
              model_version: llmManager.currentLlm.modelName,
            }
          : null;

      const response = await fetch("/api/search/send-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: message.trim(),
          llm_override,
        }),
      });

      if (!response.ok) {
        throw new Error(`Search request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body available");
      }

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
                return;
              }

              const searchDoc = data as SavedSearchDoc;
              setSearchResults((prev) => [...prev, searchDoc]);
              console.log("Search result:", searchDoc);
            } catch (e) {
              console.warn("Failed to parse streaming data:", line);
            }
          }
        }
      }
    } catch (error) {
      console.error("Search submission error:", error);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (searchInputRef.current) {
      searchInputRef.current.value = suggestion;
      handleSubmit();
    }
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
          <SearchInputBar onSubmit={handleSubmit} ref={searchInputRef} />
          <div className="w-full pt-6 flex-shrink-0">
            <SearchSuggestions onSuggestionClick={handleSuggestionClick} />
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="w-full max-w-3xl p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col py-3 gap-y-4 flex-shrink-0">
              {/* Title */}
              <h2 className="px-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Search Results ({searchResults.length})
              </h2>
            </div>

            <Separator />

            <div className="flex-1">
              {searchResults.map((doc, index) => (
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
