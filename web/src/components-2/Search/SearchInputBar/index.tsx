import { SearchIcon } from "@/components/icons/icons";
import React, { forwardRef, useState } from "react";

type SearchInputBarProps = {
  onSubmit: () => void;
};

const SearchInputBar = forwardRef<HTMLInputElement, SearchInputBarProps>(
  ({ onSubmit }, ref) => {
    const [inputValue, setInputValue] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    };

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          value={inputValue}
          onChange={handleChange}
          className="
            px-6
            w-full
            h-fit
            py-4
            flex
            flex-col
            shadow-lg
            bg-input-background
            dark:border-none
            rounded-2xl
            overflow-hidden
            text-text-chatbar
            focus:outline-none
            border-[0.5px]
            h-[60px]
            rounded-2xl
            pr-12
          "
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !(event.nativeEvent as any).isComposing
            ) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />

        {!inputValue && (
          <div className="absolute inset-y-0 px-6 flex items-center pointer-events-none">
            <span className="text-sm text-neutral-400">Search Anything</span>
          </div>
        )}

        <div className="absolute inset-y-0 right-0 px-6 flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSubmit();
            }}
            className="
              text-neutral-400
              hover:text-neutral-700
              dark:text-neutral-500
              dark:hover:text-neutral-300
              ease-in-out
              transition-all
              duration-200
            "
          >
            <SearchIcon size={18} />
          </button>
        </div>
      </div>
    );
  }
);

SearchInputBar.displayName = "SearchInputBar";

export default SearchInputBar;
