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
          : "bg-neutral-100 text-neutral-900"
      } h-5 px-1 py-0.5 rounded-lg cursor-pointer text-[10px] font-normal leading-[10px] border border-black justify-center items-center gap-1 inline-flex`}
      onClick={toggleFilter}
    >
      {text}
    </div>
  );
};

enum AssistantFilter {
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

function DraggableAssistantListItem({ ...props }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.assistant.id.toString() });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 1000 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className="flex mt-2 items-center">
      <div {...attributes} {...listeners} className="mr-2 cursor-grab">
        <DragHandle />
      </div>
      <div className="flex-grow">
        <AssistantListItem isDragging={isDragging} {...props} />
      </div>
    </div>
  );
}

function AssistantListItem({
  assistant,
  user,
  allUsers,
  isVisible,
  setPopup,
  deleteAssistant,
  shareAssistant,
  isDragging,
  onlyAssistant,
}: {
  assistant: Persona;
  user: User | null;
  allUsers: MinimalUserSnapshot[];
  isVisible: boolean;
  deleteAssistant: Dispatch<SetStateAction<Persona | null>>;
  shareAssistant: Dispatch<SetStateAction<Persona | null>>;
  setPopup: (popupSpec: PopupSpec | null) => void;
  isDragging?: boolean;
  onlyAssistant: boolean;
}) {
  const { refreshUser } = useUser();
  const router = useRouter();
  const [showSharingModal, setShowSharingModal] = useState(false);

  const isEnterpriseEnabled = usePaidEnterpriseFeaturesEnabled();
  const isOwnedByUser = checkUserOwnsAssistant(user, assistant);
  const { isAdmin } = useUser();
  const { filters, toggleFilter } = useAssistantFilter();

  return (
    <>
      <AssistantSharingModal
        assistant={assistant}
        user={user}
        allUsers={allUsers}
        onClose={() => {
          setShowSharingModal(false);
          router.refresh();
        }}
        show={showSharingModal}
      />
      <div
        className={`rounded-lg px-4 py-6 transition-all duration-900 hover:bg-background-125 ${
          isDragging && "bg-background-125"
        }`}
      >
        <div className="flex justify-between items-center">
          <AssistantIcon assistant={assistant} />

          <h2 className="ml-6 w-fit flex-grow space-y-3 text-start flex text-xl font-semibold line-clamp-2 text-gray-800">
            {assistant.name}
          </h2>

          <div className="flex flex-none items-center space-x-4">
            <div className="flex mr-20 flex-wrap items-center gap-x-4">
              {assistant.tools.length > 0 && (
                <p className="text-base flex w-fit text-subtle">
                  {assistant.tools.length} tool
                  {assistant.tools.length > 1 && "s"}
                </p>
              )}
              <AssistantSharedStatusDisplay
                size="md"
                assistant={assistant}
                user={user}
              />
            </div>

            {isOwnedByUser ? (
              <Link
                href={`/assistants/edit/${assistant.id}`}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
                title="Edit assistant"
              >
                <FiEdit2 size={20} className="text-text-900" />
              </Link>
            ) : (
              <CustomTooltip
                showTick
                content="You don't have permission to edit this assistant"
              >
                <div className="p-2 cursor-not-allowed opacity-50 rounded-full hover:bg-gray-100 transition-colors duration-200">
                  <FiEdit2 size={20} className="text-text-900" />
                </div>
              </CustomTooltip>
            )}

            <DefaultPopover
              content={
                <div className="p-2 rounded-full hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                  <FiMoreHorizontal size={20} className="text-text-900" />
                </div>
              }
              side="bottom"
              align="end"
              sideOffset={5}
            >
              {[
                isVisible ? (
                  <button
                    key="remove"
                    className="flex items-center gap-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                    onClick={async () => {
                      if (onlyAssistant) {
                        setPopup({
                          message: `Cannot remove "${assistant.name}" - you must have at least one assistant.`,
                          type: "error",
                        });
                        return;
                      }

                      const success = await removeAssistantFromList(
                        assistant.id
                      );
                      if (success) {
                        setPopup({
                          message: `"${assistant.name}" has been removed from your list.`,
                          type: "success",
                        });
                        await refreshUser();
                      } else {
                        setPopup({
                          message: `"${assistant.name}" could not be removed from your list.`,
                          type: "error",
                        });
                      }
                    }}
                  >
                    <FiX size={18} className="text-text-800" />{" "}
                    {isOwnedByUser ? "Hide" : "Remove"}
                  </button>
                ) : (
                  <button
                    key="add"
                    className="flex items-center gap-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                    onClick={async () => {
                      const success = await addAssistantToList(assistant.id);
                      if (success) {
                        setPopup({
                          message: `"${assistant.name}" has been added to your list.`,
                          type: "success",
                        });
                        await refreshUser();
                      } else {
                        setPopup({
                          message: `"${assistant.name}" could not be added to your list.`,
                          type: "error",
                        });
                      }
                    }}
                  >
                    <FiPlus size={18} className="text-text-800" /> Add
                  </button>
                ),

                (isOwnedByUser || isAdmin) && isEnterpriseEnabled ? (
                  <button
                    key="view-stats"
                    className="flex items-center gap-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                    onClick={() =>
                      router.push(`/assistants/stats/${assistant.id}`)
                    }
                  >
                    <FiBarChart size={18} /> View Stats
                  </button>
                ) : null,
                isOwnedByUser ? (
                  <button
                    key="delete"
                    className="flex items-center gap-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left text-red-600"
                    onClick={() => deleteAssistant(assistant)}
                  >
                    <FiTrash size={18} /> Delete
                  </button>
                ) : null,
                isOwnedByUser ? (
                  <button
                    key="visibility"
                    className="flex items-center gap-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                    onClick={() => shareAssistant(assistant)}
                  >
                    {assistant.is_public ? (
                      <FiMinus size={18} className="text-text-800" />
                    ) : (
                      <FiPlus size={18} className="text-text-800" />
                    )}{" "}
                    Make {assistant.is_public ? "Private" : "Public"}
                  </button>
                ) : null,
                !assistant.is_public ? (
                  <button
                    key="share"
                    className="flex items-center gap-x-2 px-4 py-2 hover:bg-gray-100 w-full text-left"
                    onClick={(e) => {
                      setShowSharingModal(true);
                    }}
                  >
                    <FiShare2 size={18} className="text-text-800" /> Share
                  </button>
                ) : null,
              ]}
            </DefaultPopover>
          </div>
          {/* )} */}
        </div>
      </div>
    </>
  );
}
export function AssistantsList() {
  const {
    assistants,
    ownedButHiddenAssistants,
    finalAssistants,
    refreshAssistants,
  } = useAssistants();

  const [currentlyVisibleAssistants, setCurrentlyVisibleAssistants] =
    useState(finalAssistants);

  useEffect(() => {
    setCurrentlyVisibleAssistants(finalAssistants);
  }, [finalAssistants]);

  const { filters, toggleFilter } = useAssistantFilter();
  const [deletingPersona, setDeletingPersona] = useState<Persona | null>(null);
  const [makePublicPersona, setMakePublicPersona] = useState<Persona | null>(
    null
  );

  const { refreshUser, user } = useUser();

  const { popup, setPopup } = usePopup();

  const { data: users } = useSWR<MinimalUserSnapshot[]>(
    "/api/users",
    errorHandlingFetcher
  );

  const router = useRouter();

  return (
    <>
      {popup}
      {deletingPersona && (
        <DeleteEntityModal
          entityType="Assistant"
          entityName={deletingPersona.name}
          onClose={() => setDeletingPersona(null)}
          onSubmit={async () => {
            const success = await deletePersona(deletingPersona.id);
            if (success) {
              setPopup({
                message: `"${deletingPersona.name}" has been deleted.`,
                type: "success",
              });
              await refreshUser();
            } else {
              setPopup({
                message: `"${deletingPersona.name}" could not be deleted.`,
                type: "error",
              });
            }
            setDeletingPersona(null);
          }}
        />
      )}

      {makePublicPersona && (
        <MakePublicAssistantModal
          isPublic={makePublicPersona.is_public}
          onClose={() => setMakePublicPersona(null)}
          onShare={async (newPublicStatus: boolean) => {
            await togglePersonaPublicStatus(
              makePublicPersona.id,
              newPublicStatus
            );
            await refreshAssistants();
          }}
        />
      )}

      <Modal className="w-full max-w-3xl " width="w-full max-w-3xl ">
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
    </>
  );
}
