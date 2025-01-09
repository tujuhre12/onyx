"use client";

import React, { Dispatch, SetStateAction, useEffect, useState } from "react";
import { MinimalUserSnapshot, User } from "@/lib/types";
import { Persona } from "@/app/admin/assistants/interfaces";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FiBarChart,
  FiEdit2,
  FiList,
  FiMinus,
  FiMoreHorizontal,
  FiPlus,
  FiShare2,
  FiTrash,
  FiX,
} from "react-icons/fi";
import Link from "next/link";
import {
  addAssistantToList,
  removeAssistantFromList,
  updateUserAssistantList,
} from "@/lib/assistants/updateAssistantPreferences";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { DefaultPopover } from "@/components/popover/DefaultPopover";
import { PopupSpec, usePopup } from "@/components/admin/connectors/Popup";
import { useRouter } from "next/navigation";
import { AssistantsPageTitle } from "../AssistantsPageTitle";
import { checkUserOwnsAssistant } from "@/lib/assistants/checkOwnership";
import { AssistantSharingModal } from "./AssistantSharingModal";
import { AssistantSharedStatusDisplay } from "../AssistantSharedStatus";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { DragHandle } from "@/components/table/DragHandle";
import {
  deletePersona,
  togglePersonaPublicStatus,
} from "@/app/admin/assistants/lib";
import { DeleteEntityModal } from "@/components/modals/DeleteEntityModal";
import { MakePublicAssistantModal } from "@/app/chat/modal/MakePublicAssistantModal";
import { CustomTooltip } from "@/components/tooltip/CustomTooltip";
import { useAssistants } from "@/components/context/AssistantsContext";
import { useUser } from "@/components/user/UserProvider";
import { usePaidEnterpriseFeaturesEnabled } from "@/components/settings/usePaidEnterpriseFeaturesEnabled";
import { Modal } from "@/components/Modal";
import { AssistantCard } from "@/components/assistants/AssistantCards";
import NewAssistantCard from "../gallery/AssistantCard";

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
      } h-5 px-1 py-0.5 rounded-lg cursor-pointer text-[10px] font-normal leading-[10px] border border-black justify-center items-center gap-1 inline-flex`}
      onClick={toggleFilter}
    >
      {text}
    </div>
  );
};

export enum AssistantFilter {
  Recent = "Recent",
  AdminCreated = "Admin created",
  Pinned = "Pinned",
  Private = "Private",
  Public = "Public",
}

const useAssistantFilter = () => {
  const [filters, setFilters] = useState<Record<AssistantFilter, boolean>>({
    [AssistantFilter.Recent]: false,
    [AssistantFilter.AdminCreated]: false,
    [AssistantFilter.Pinned]: false,
    [AssistantFilter.Private]: false,
    [AssistantFilter.Public]: false,
  });

  const toggleFilter = (filter: AssistantFilter) => {
    setFilters((prevFilters) => ({
      ...prevFilters,
      [filter]: !prevFilters[filter],
    }));
  };

  return { filters, toggleFilter };
};

export default function AssistantModal({
  currentlyVisibleAssistants,
  hideModal,
}: {
  currentlyVisibleAssistants: Persona[];
  hideModal: () => void;
}) {
  const { filters, toggleFilter } = useAssistantFilter();
  const router = useRouter();
  return (
    <Modal
      onOutsideClick={hideModal}
      className="w-full max-w-3xl "
      width="w-full max-w-3xl "
    >
      <>
        <div className="flex justify-between items-center mb-0">
          <div className="h-10 px-4 w-full  rounded-lg flex-col justify-center items-start gap-2.5 inline-flex">
            <div className="h-16 rounded-lg w-full shadow-[0px_0px_2px_0px_rgba(0,0,0,0.25)] border border-[#dcdad4] flex items-center px-3">
              <input
                type="text"
                className="w-full h-full bg-transparent outline-none text-black"
              />
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
            </div>
          </div>
          <button
            onClick={() => router.push("/assistants/new")}
            className="h-10 cursor-pointer px-6 py-3 bg-black rounded border border-black justify-center items-center gap-2.5 inline-flex"
          >
            <div className="text-[#fffcf4] text-base font-normal leading-normal">
              Create
            </div>
          </button>
        </div>
        <div className="ml-4 flex py-2 items-center gap-x-2">
          <AssistantBadgeSelector
            text="Public"
            selected={filters[AssistantFilter.Public]}
            toggleFilter={() => toggleFilter(AssistantFilter.Public)}
          />
          <AssistantBadgeSelector
            text="Private"
            selected={filters[AssistantFilter.Private]}
            toggleFilter={() => toggleFilter(AssistantFilter.Private)}
          />
          <AssistantBadgeSelector
            text="Hidden"
            selected={filters[AssistantFilter.Pinned]}
            toggleFilter={() => toggleFilter(AssistantFilter.Pinned)}
          />
          <AssistantBadgeSelector
            text="Admin Created"
            selected={filters[AssistantFilter.AdminCreated]}
            toggleFilter={() => toggleFilter(AssistantFilter.AdminCreated)}
          />
          <AssistantBadgeSelector
            text="Recent"
            selected={filters[AssistantFilter.Recent]}
            toggleFilter={() => toggleFilter(AssistantFilter.Recent)}
          />
        </div>

        <div className="w-full mt-2 h-full px-2 grid grid-cols-2 gap-4">
          {currentlyVisibleAssistants.map((assistant, index) => (
            <div key={assistant.id}>
              <NewAssistantCard persona={assistant} />
            </div>
          ))}
        </div>
      </>
    </Modal>
  );
}
