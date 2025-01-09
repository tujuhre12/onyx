import React, { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { FiCalendar, FiFilter, FiFolder, FiTag } from "react-icons/fi";
import { FilterDropdown } from "@/components/search/filtering/FilterDropdown";
import { getDateRangeString } from "@/lib/dateUtils";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { FilterManager } from "@/lib/hooks";
import { ValidSources } from "@/lib/types";
import { DocumentSet, Tag } from "@/lib/types";
import { SourceMetadata } from "@/lib/search/interfaces";
import { getSourceMetadata } from "@/lib/sources";

interface FilterPopupProps {
  filterManager: FilterManager;
  trigger: React.ReactNode;
  availableSources: SourceMetadata[];
  availableDocumentSets: DocumentSet[];
  availableTags: Tag[];
}

export enum FilterCategories {
  date = "date",
  sources = "sources",
  documentSets = "documentSets",
  tags = "tags",
}

export function FilterPopup({
  availableSources,
  availableDocumentSets,
  availableTags,
  filterManager,
  trigger,
}: FilterPopupProps) {
  const handleSelect = (source: ValidSources) => {
    filterManager.setSelectedSources((prev: SourceMetadata[]) => {
      if (prev.map((source) => source.internalName).includes(source)) {
        return prev.filter((s) => s.internalName !== source);
      } else {
        return [...prev, getSourceMetadata(source)];
      }
    });
  };

  const [hoveredFilter, setHoveredFilter] = useState<FilterCategories | null>(
    null
  );

  const handleDateRangeSelect = (selectedRange: DateRange | undefined) => {
    if (selectedRange?.from && selectedRange?.to) {
      filterManager.setTimeRange({
        from: selectedRange.from,
        to: selectedRange.to,
        selectValue: "",
      });
    } else {
      filterManager.setTimeRange(null);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button>{trigger}</button>
      </PopoverTrigger>
      <PopoverContent className="h-[400px] w-[350px] p-0" align="start">
        <div className="flex">
          {/* Left column: Filter types */}
          <div className="w-1/3 text-sm border-r border-border-light">
            <ul className="py-2">
              <li
                className="px-4 py-2 flex items-center gap-x-1 hover:bg-background-hover cursor-pointer"
                onMouseEnter={() => setHoveredFilter(FilterCategories.date)}
              >
                <FiCalendar className="flex-none" />
                <span>Range</span>
              </li>
              <li
                className="px-4 py-2 flex items-center gap-x-1 hover:bg-background-hover cursor-pointer"
                onMouseEnter={() => setHoveredFilter(FilterCategories.sources)}
              >
                <FiFilter className="flex-none" />
                <span>Sources</span>
              </li>
              <li
                className="px-4 py-2 flex items-center gap-x-1 hover:bg-background-hover cursor-pointer"
                onMouseEnter={() =>
                  setHoveredFilter(FilterCategories.documentSets)
                }
              >
                <FiFolder className="flex-none" />
                <span>Sets</span>
              </li>
              <li
                className="px-4 py-2 flex items-center gap-x-1 hover:bg-background-hover cursor-pointer"
                onMouseEnter={() => setHoveredFilter(FilterCategories.tags)}
              >
                <FiTag className="flex-none" />
                <span>Tags</span>
              </li>
            </ul>
          </div>

          {/* Right column: Filter options */}
          <div className="w-2/3 p-4">
            {hoveredFilter === FilterCategories.date && (
              <div>
                <h3 className="font-semibold mb-2">Date Range</h3>
                <Calendar
                  mode="range"
                  selected={filterManager.timeRange || undefined}
                  onSelect={handleDateRangeSelect}
                  className="rounded-md"
                />
              </div>
            )}

            {hoveredFilter === FilterCategories.sources && (
              <div>
                <h3 className="font-semibold mb-2">Sources</h3>
                <ul>
                  {availableSources.map((source, index) => (
                    <li key={index} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={filterManager.selectedSources.some(
                          (s) => s.internalName === source.internalName
                        )}
                        onChange={() => {
                          handleSelect(source.internalName);
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={source.internalName}>
                        {source.displayName}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hoveredFilter === FilterCategories.documentSets && (
              <div>
                <h3 className="font-semibold mb-2">Document Sets</h3>
                <ul>
                  {availableDocumentSets.map((docSet, index) => (
                    <li key={index} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={docSet.id.toString()}
                        checked={filterManager.selectedDocumentSets.includes(
                          docSet.id.toString()
                        )}
                        onChange={() => {
                          if (
                            filterManager.selectedDocumentSets.includes(
                              docSet.id.toString()
                            )
                          ) {
                            filterManager.setSelectedDocumentSets(
                              (documentIds: string[]) =>
                                documentIds.filter(
                                  (ds: string) => ds !== docSet.id.toString()
                                )
                            );
                          } else {
                            filterManager.setSelectedDocumentSets(
                              (documentIds: string[]) => [
                                ...documentIds,
                                docSet.id.toString(),
                              ]
                            );
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={docSet.id.toString()}>
                        {docSet.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {hoveredFilter === FilterCategories.tags && (
              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <ul>
                  {availableTags.map((tag) => (
                    <li key={tag.tag_value} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        id={tag.tag_value}
                        checked={filterManager.selectedTags.some(
                          (t) => t.tag_value === tag.tag_value
                        )}
                        onChange={() => {
                          const isSelected = filterManager.selectedTags.some(
                            (t) => t.tag_value === tag.tag_value
                          );
                          if (isSelected) {
                            filterManager.setSelectedTags((prev) =>
                              prev.filter((t) => t.tag_value !== tag.tag_value)
                            );
                          } else {
                            filterManager.setSelectedTags((prev) => [
                              ...prev,
                              tag,
                            ]);
                          }
                        }}
                        className="mr-2"
                      />
                      <label htmlFor={tag.tag_value}>{tag.tag_value}</label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
