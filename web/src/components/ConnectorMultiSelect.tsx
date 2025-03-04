import React, { useState, useRef, useEffect } from "react";
import { ConnectorStatus } from "@/lib/types";
import { ConnectorTitle } from "@/components/admin/connectors/ConnectorTitle";
import { Check, ChevronsUpDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ErrorMessage } from "formik";

interface ConnectorMultiSelectProps {
  name: string;
  label: string;
  connectors: ConnectorStatus<any, any>[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ConnectorMultiSelect = ({
  name,
  label,
  connectors,
  selectedIds,
  onChange,
  disabled = false,
  placeholder = "Search connectors...",
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

  // Filter unselected connectors based on search query
  const filteredUnselectedConnectors = unselectedConnectors.filter(
    (connector) => {
      const connectorName = connector.name || connector.connector.source;
      return connectorName.toLowerCase().includes(searchQuery.toLowerCase());
    }
  );

  // Handle selection
  const selectConnector = (connectorId: number) => {
    onChange([...selectedIds, connectorId]);
    setSearchQuery(""); // Clear search after selection

    // Focus back on input after selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
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

  return (
    <div className="flex flex-col max-w-md space-y-2 mb-4">
      {label && <Label className="text-base font-medium mb-1">{label}</Label>}

      {/* Persistent search bar */}
      <div className="relative">
        <div className="flex items-center border border-input rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:border-neutral-400 transition-colors">
          <Search className="absolute left-3 h-4 w-4 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-9 w-full pl-9 pr-10 py-2 bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              if (!open) {
                inputRef.current?.focus();
              }
            }}
            className="absolute right-3 flex items-center justify-center h-5 w-5 text-neutral-500 hover:text-neutral-700 rounded-full hover:bg-neutral-100"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Dropdown for unselected connectors */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 rounded-md border border-neutral-200 bg-white shadow-md max-h-[300px] overflow-auto"
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
                    className="flex items-center justify-between py-2 px-3 cursor-pointer hover:bg-background-50 text-xs"
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
                    <div className="flex-shrink-0 text-neutral-400 hover:text-blue-500">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected connectors display */}
      {selectedConnectors.length > 0 ? (
        <div className="mt-3 p-3 border border-neutral-200 rounded-md bg-background-50">
          <div className="text-xs font-medium text-neutral-700 mb-2">
            Selected connectors:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedConnectors.map((connector) => (
              <div
                key={connector.cc_pair_id}
                className="flex items-center bg-white rounded-md border border-neutral-300 shadow-sm hover:shadow-md transition-all px-2 py-1 max-w-full group text-xs"
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

      <p className="text-xs text-neutral-500 mt-1">
        All documents indexed by the selected connectors will be part of this
        document set.
      </p>

      <ErrorMessage
        name={name}
        component="div"
        className="text-red-500 text-xs mt-1"
      />
    </div>
  );
};
