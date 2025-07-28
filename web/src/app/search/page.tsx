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
import { Calendar } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { getXDaysAgo } from "@/components/dateRangeSelectors/dateUtils";
import { Separator } from "@/components/ui/separator";

type PageProps = {
  searchParams: Promise<{ [key: string]: string }>;
};

type DateRange =
  | {
      from: Date;
      to: Date;
    }
  | undefined;

export default function Page(props: PageProps) {
  const [message, setMessage] = useState("");
  const [chatState, setChatState] = useState<ChatState>("input");
  const [searchResults, setSearchResults] = useState<SavedSearchDoc[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<string | null>(
    null
  );
  const [dateRange, setDateRange] = useState<DateRange>(undefined);

  const { llmProviders } = useChatContext();
  const llmManager: LlmManager = useLlmManager(llmProviders);
  const filterManager = useFilters();

  // Helper function to check if a date falls within the selected range
  const isDateInRange = (dateString: string | null): boolean => {
    if (!dateString || !dateRange) return true;

    const date = new Date(dateString);
    const from = dateRange.from;
    const to = dateRange.to;

    return date >= from && date <= to;
  };

  const presets = [
    {
      label: "Last 30 days",
      value: {
        from: getXDaysAgo(30),
        to: getXDaysAgo(0),
      },
    },
    {
      label: "Last 7 days",
      value: {
        from: getXDaysAgo(7),
        to: getXDaysAgo(0),
      },
    },
    {
      label: "Today",
      value: {
        from: getXDaysAgo(1),
        to: getXDaysAgo(0),
      },
    },
  ];

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
          <div className="w-full max-w-3xl p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex flex-col py-3 gap-y-4 flex-shrink-0">
              {/* Title */}
              <h2 className="px-5 text-lg font-semibold text-gray-900 dark:text-gray-100">
                Search Results ({searchResults.length})
              </h2>

              {/* Filter Buttons */}
              <div className="px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Source Type Filter */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          selectedSourceType &&
                            "border-blue-500 ring-1 ring-blue-500"
                        )}
                      >
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
                      </Button>
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

                  {/* Date Range Filter */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          dateRange && "border-blue-500 ring-1 ring-blue-500"
                        )}
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>All Dates</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={(range) => {
                          if (range?.from) {
                            if (range.to) {
                              // Normal range selection when initialized with a range
                              setDateRange({ from: range.from, to: range.to });
                            } else {
                              // Single date selection when initilized without a range
                              const to = new Date(range.from);
                              const from = new Date(
                                to.setDate(to.getDate() - 1)
                              );
                              setDateRange({ from, to });
                            }
                          }
                        }}
                        numberOfMonths={2}
                      />
                      <div className="border-t p-3">
                        {presets.map((preset) => (
                          <Button
                            key={preset.label}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => {
                              setDateRange(preset.value);
                            }}
                          >
                            {preset.label}
                          </Button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Clear Button */}
                <button
                  className={cn(
                    "p-2 transition-colors",
                    selectedSourceType || dateRange
                      ? "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      : "text-gray-300 dark:text-gray-600"
                  )}
                  onClick={() => {
                    setSelectedSourceType(null);
                    setDateRange(undefined);
                  }}
                >
                  <FiX size={16} />
                </button>
              </div>
            </div>

            <Separator />

            <div className="flex-1">
              {searchResults
                .filter(
                  (doc) =>
                    (!selectedSourceType ||
                      doc.source_type === selectedSourceType) &&
                    isDateInRange(doc.updated_at)
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
