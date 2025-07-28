"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function Page(_props: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams?.get("query");

  // We only display the "starting page" when we have no query parameter set.
  // Otherwise, we display the results.
  const shouldDisplayStartingPage = queryParam === null;

  // Initialize query from URL parameter
  const [query, setQuery] = useState<string | null>(queryParam);
  const [searchResults, setSearchResults] = useState<SavedSearchDoc[]>([]);
  const { llmProviders } = useChatContext();
  const llmManager = useLlmManager(llmProviders);

  // Sync query state with URL parameter changes
  useEffect(() => {
    if (queryParam !== query) {
      setQuery(queryParam);
      if (queryParam) {
        handleSubmit(queryParam);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (searchQuery: string) => {
    if (!searchQuery) {
      return;
    }

    // Update URL with the query parameter
    const newSearchParams = new URLSearchParams(searchParams?.toString() || "");
    newSearchParams.set("query", searchQuery);
    router.push(`/search?${newSearchParams.toString()}`);

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
          query: searchQuery.trim(),
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

  const handleSearchSubmit = () => {
    if (query) {
      handleSubmit(query);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSubmit(suggestion);
  };

  const handleClear = () => {
    setQuery(null);
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-background">
      <div className="w-full px-4 flex flex-col items-center justify-center h-full overflow-y-scroll">
        {/* Onyx Logo */}
        {shouldDisplayStartingPage && (
          <div className="flex justify-center pb-8 flex-shrink-0">
            <OnyxLogoTypeIcon size={200} />
          </div>
        )}

        {/* Search Bar */}
        <div className="w-full max-w-3xl">
          <SearchInputBar
            onSubmit={handleSearchSubmit}
            value={query}
            onChange={setQuery}
            onClear={handleClear}
          />
          {shouldDisplayStartingPage && (
            <div className="w-full pt-6 flex-shrink-0">
              <SearchSuggestions onSuggestionClick={handleSuggestionClick} />
            </div>
          )}
        </div>

        {/* Search Results */}
        {!shouldDisplayStartingPage && (
          <div className="w-full max-w-3xl p-1 flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col py-3 gap-y-4 flex-shrink-0"></div>

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
