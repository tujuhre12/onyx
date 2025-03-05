import React, { useState, useRef, useEffect } from "react";
import { ConnectorStatus } from "@/lib/types";
import { ConnectorTitle } from "@/components/admin/connectors/ConnectorTitle";
import { Check, ChevronsUpDown, X, Search, LockIcon, Key } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ErrorMessage } from "formik";
import { FiGlobe } from "react-icons/fi";

interface ConnectorMultiSelectProps {
  name: string;
  label: string;
  connectors: ConnectorStatus<any, any>[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
  showError?: boolean;
}

export const ConnectorMultiSelect = ({
  name,
  label,
  connectors,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "Search connectors...",
  showError = false,
}: ConnectorMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected and unselected connectors
  const selectedConnectors = connectors.filter((connector) =>
    selectedIds.includes(connector.cc_pair_id)
  );

  const unselectedConnectors = connectors.filter(
    (connector) => !selectedIds.includes(connector.cc_pair_id)
  );

  // Check if all connectors are selected
  const allConnectorsSelected = unselectedConnectors.length === 0;

  // Filter unselected connectors based on search query
  const filteredUnselectedConnectors = unselectedConnectors.filter(
    (connector) => {
      const connectorName = connector.name || connector.connector.source;
      return connectorName.toLowerCase().includes(searchQuery.toLowerCase());
    }
  );

  // Close dropdown if there are no more connectors to select
  useEffect(() => {
    if (allConnectorsSelected && open) {
      setOpen(false);
      // Blur the input to remove focus when all connectors are selected
      inputRef.current?.blur();
      // Clear search query when all connectors are selected
      setSearchQuery("");
    }
  }, [allConnectorsSelected, open]);

  // Also check when selectedIds changes to handle the case when the last connector is selected
  useEffect(() => {
    if (allConnectorsSelected) {
      inputRef.current?.blur();
      setSearchQuery("");
    }
  }, [allConnectorsSelected, selectedIds]);

  // Handle selection
  const selectConnector = (connectorId: number) => {
    const newSelectedIds = [...selectedIds, connectorId];
    onChange(newSelectedIds);
    setSearchQuery(""); // Clear search after selection

    // Check if this was the last connector to select
    const willAllBeSelected = connectors.length === newSelectedIds.length;

    // Only focus back on input if there are still connectors to select
    if (!willAllBeSelected) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  // Remove a selected connector
  const removeConnector = (connectorId: number) => {
    onChange(selectedIds.filter((id) => id !== connectorId));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current !== event.target &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Determine the placeholder text based on whether all connectors are selected
  const effectivePlaceholder = allConnectorsSelected
    ? "All connectors selected"
    : placeholder;

  // Determine if the input should be disabled
  const isInputDisabled = disabled || allConnectorsSelected;

  return (
    <div className="flex flex-col w-full space-y-2 mb-4">
      {label && <Label className="text-base font-medium">{label}</Label>}

      <p className="text-xs text-neutral-500 ">
        All documents indexed by the selected connectors will be part of this
        document set.
      </p>
      {/* Persistent search bar */}
      <div className="relative">
        <div
          className={`flex items-center border border-input rounded-md border border-neutral-200 ${
            allConnectorsSelected ? "bg-neutral-50" : ""
          } focus-within:ring-1 focus-within:ring-ring focus-within:border-neutral-400 transition-colors`}
        >
          <Search className="absolute left-3 h-4 w-4 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (!allConnectorsSelected) {
                setOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            className={`h-9 w-full pl-9 pr-10 py-2 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
              allConnectorsSelected ? "text-neutral-500" : ""
            }`}
            disabled={isInputDisabled}
          />
        </div>

        {/* Dropdown for unselected connectors */}
        {open && !allConnectorsSelected && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 rounded-md border border-neutral-200 bg-white shadow-md default-scrollbar max-h-[300px] overflow-auto"
          >
            {filteredUnselectedConnectors.length === 0 ? (
              <div className="py-4 text-center text-xs text-neutral-500">
                {searchQuery
                  ? "No matching connectors found"
                  : "No more connectors available"}
              </div>
            ) : (
              <div>
                {filteredUnselectedConnectors.map((connector) => (
                  <div
                    key={connector.cc_pair_id}
                    className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-neutral-50 text-xs"
                    onClick={() => selectConnector(connector.cc_pair_id)}
                  >
                    <div className="flex items-center truncate mr-2">
                      <ConnectorTitle
                        connector={connector.connector}
                        ccPairId={connector.cc_pair_id}
                        ccPairName={connector.name}
                        isLink={false}
                        showMetadata={false}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedConnectors.length > 0 ? (
        <div className="mt-3 ">
          <div className="flex flex-wrap gap-1.5">
            {selectedConnectors.map((connector) => (
              <div
                key={connector.cc_pair_id}
                className="flex items-center bg-white rounded-md border border-neutral-300 transition-all px-2 py-1 max-w-full group text-xs"
              >
                <div className="flex items-center overflow-hidden">
                  <div className="flex-shrink-0 text-xs">
                    <ConnectorTitle
                      connector={connector.connector}
                      ccPairId={connector.cc_pair_id}
                      ccPairName={connector.name}
                      isLink={false}
                      showMetadata={false}
                    />
                  </div>
                </div>
                <button
                  className="ml-1 flex-shrink-0 rounded-full w-4 h-4 flex items-center justify-center bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700 transition-colors group-hover:bg-neutral-200"
                  onClick={() => removeConnector(connector.cc_pair_id)}
                  aria-label="Remove connector"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 p-3 border border-dashed border-neutral-300 rounded-md bg-neutral-50 text-neutral-500 text-xs">
          No connectors selected. Search and select connectors above.
        </div>
      )}

      {showError && (
        <ErrorMessage
          name={name}
          component="div"
          className="text-red-500 text-xs mt-1"
        />
      )}
    </div>
  );
};
