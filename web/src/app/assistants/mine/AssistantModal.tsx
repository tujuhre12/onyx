"use client";

import React, { useMemo, useState } from "react";
import { Persona } from "@/app/admin/assistants/interfaces";
import { useRouter } from "next/navigation";

import { Modal } from "@/components/Modal";
import AssistantCard from "./AssistantCard";
import { useAssistants } from "@/components/context/AssistantsContext";
import { checkUserOwnsAssistant } from "@/lib/assistants/checkOwnership";
import { useUser } from "@/components/user/UserProvider";

export const AssistantBadgeSelector = ({
  text,
  selected,
  toggleFilter,
}: {
  text: string;
  selected: boolean;
  toggleFilter: () => void;
}) => {
  return (
    <div
      className={`${
        selected
          ? "bg-neutral-900 text-white"
          : "bg-transparent text-neutral-900"
      } h-5 px-1 py-0.5 rounded-lg cursor-pointer text-[12px] font-normal leading-[10px] border border-black justify-center items-center gap-1 inline-flex`}
      onClick={toggleFilter}
    >
      {text}
    </div>
  );
};

export enum AssistantFilter {
  AdminCreated = "Admin",
  UserCreated = "User-created", // Add this
  Pinned = "Pinned",
  Private = "Private",
  Public = "Public",
  Builtin = "Builtin",
}

const useAssistantFilter = () => {
  const [assistantFilters, setAssistantFilters] = useState<
    Record<AssistantFilter, boolean>
  >({
    [AssistantFilter.Builtin]: false,
    [AssistantFilter.AdminCreated]: false,
    [AssistantFilter.Pinned]: false,
    [AssistantFilter.Private]: false,
    [AssistantFilter.Public]: false,
    [AssistantFilter.UserCreated]: false,
  });

  const toggleAssistantFilter = (filter: AssistantFilter) => {
    setAssistantFilters((prevFilters) => ({
      ...prevFilters,
      [filter]: !prevFilters[filter],
    }));
  };

  return { assistantFilters, toggleAssistantFilter };
};

export default function AssistantModal({
  hideModal,
}: {
  hideModal: () => void;
}) {
  const { assistants, visibleAssistants, pinnedAssistants } = useAssistants();
  const { assistantFilters, toggleAssistantFilter } = useAssistantFilter();
  const router = useRouter();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const memoizedCurrentlyVisibleAssistants = useMemo(() => {
    return assistants.filter((assistant) => {
      const nameMatches = assistant.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const publicFilter =
        !assistantFilters[AssistantFilter.Public] || assistant.is_public;
      const privateFilter =
        !assistantFilters[AssistantFilter.Private] || !assistant.is_public;
      const pinnedFilter =
        !assistantFilters[AssistantFilter.Pinned] ||
        pinnedAssistants.map((a: Persona) => a.id).includes(assistant.id);
      const adminCreatedFilter =
        !assistantFilters[AssistantFilter.AdminCreated] ||
        assistant.is_default_persona;

      const builtinFilter =
        !assistantFilters[AssistantFilter.Builtin] || assistant.builtin_persona;
      const isOwnedByUser = checkUserOwnsAssistant(user, assistant);

      const userCreatedFilter =
        !assistantFilters[AssistantFilter.UserCreated] || isOwnedByUser;

      return (
        nameMatches &&
        publicFilter &&
        privateFilter &&
        pinnedFilter &&
        adminCreatedFilter &&
        builtinFilter &&
        userCreatedFilter
      );
    });
  }, [assistants, searchQuery, assistantFilters, pinnedAssistants]);

  const maxHeight = 900;
  const calculatedHeight = Math.min(
    Math.ceil(assistants.length / 2) * 170 + 75,
    window.innerHeight * 0.8
  );
  const height = Math.min(calculatedHeight, maxHeight);

  return (
    <Modal
      heightOverride={`${height}px`}
      onOutsideClick={hideModal}
      removeBottomPadding
      className="max-w-4xl  w-[95%] overflow-hidden"
    >
      <div className="flex flex-col h-full">
        <div className="flex flex-col sticky top-0 z-10">
          <div className="flex justify-between items-center mb-0 px-2">
            <div className="h-12 px-2 w-full rounded-lg flex-col justify-center items-start gap-2.5 inline-flex">
              <div className="h-12 rounded-md w-full shadow-[0px_0px_2px_0px_rgba(0,0,0,0.25)] border border-[#dcdad4] flex items-center px-3">
                {!isSearchFocused && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-gray-400"
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
                )}
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  type="text"
                  className="w-full h-full bg-transparent outline-none text-black"
                />
              </div>
            </div>
            <button
              onClick={() => router.push("/assistants/new")}
              className="h-10 cursor-pointer px-6 py-3 bg-black rounded-md border border-black justify-center items-center gap-2.5 inline-flex"
            >
              <div className="text-[#fffcf4] text-lg font-normal leading-normal">
                Create
              </div>
            </button>
          </div>
          <div className="px-2 flex py-2 items-center gap-x-2 mb-2">
            <AssistantBadgeSelector
              text="Public"
              selected={assistantFilters[AssistantFilter.Public] ?? false}
              toggleFilter={() => toggleAssistantFilter(AssistantFilter.Public)}
            />
            <AssistantBadgeSelector
              text="Private"
              selected={assistantFilters[AssistantFilter.Private] ?? false}
              toggleFilter={() =>
                toggleAssistantFilter(AssistantFilter.Private)
              }
            />
            <AssistantBadgeSelector
              text="Admin"
              selected={assistantFilters[AssistantFilter.AdminCreated] ?? false}
              toggleFilter={() =>
                toggleAssistantFilter(AssistantFilter.AdminCreated)
              }
            />
            <AssistantBadgeSelector
              text="Pinned"
              selected={assistantFilters[AssistantFilter.Pinned] ?? false}
              toggleFilter={() => toggleAssistantFilter(AssistantFilter.Pinned)}
            />
            <AssistantBadgeSelector
              text="Builtin"
              selected={assistantFilters[AssistantFilter.Builtin] ?? false}
              toggleFilter={() =>
                toggleAssistantFilter(AssistantFilter.Builtin)
              }
            />
          </div>
          <div className="w-full border-t border-neutral-200" />
        </div>

        <div className="flex-grow overflow-y-auto">
          <div className="w-full mt-2 px-2 pb-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            {memoizedCurrentlyVisibleAssistants.map((assistant, index) => (
              <div key={index}>
                <AssistantCard
                  pinned={pinnedAssistants.includes(assistant)}
                  persona={assistant}
                  closeModal={hideModal}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
