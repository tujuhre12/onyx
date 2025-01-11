"use client";

import { FiEdit, FiFolderPlus, FiMoreHorizontal, FiPlus } from "react-icons/fi";
import React, { ForwardedRef, forwardRef, useContext, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatSession } from "../interfaces";
import { NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA } from "@/lib/constants";
import { Folder } from "../folders/interfaces";
import { usePopup } from "@/components/admin/connectors/Popup";
import { SettingsContext } from "@/components/settings/SettingsProvider";

import {
  AssistantsIconSkeleton,
  NewChatIcon,
  OnyxIcon,
  PinnedIcon,
  PlusIcon,
} from "@/components/icons/icons";
import { PagesTab } from "./PagesTab";
import { pageType } from "./types";
import LogoWithText from "@/components/header/LogoWithText";
import { Persona } from "@/app/admin/assistants/interfaces";
import { useAssistants } from "@/components/context/AssistantsContext";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { buildChatUrl } from "../lib";
import { toggleAssistantPinnedStatus } from "@/lib/assistants/updateAssistantPreferences";
import { useUser } from "@/components/user/UserProvider";

interface HistorySidebarProps {
  page: pageType;
  existingChats?: ChatSession[];
  currentChatSession?: ChatSession | null | undefined;
  folders?: Folder[];
  openedFolders?: { [key: number]: boolean };
  toggleSidebar?: () => void;
  toggled?: boolean;
  removeToggle?: () => void;
  reset?: () => void;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  stopGenerating?: () => void;
  explicitlyUntoggle: () => void;
  showDeleteAllModal?: () => void;
  backgroundToggled?: boolean;
  assistants: Persona[];
  currentAssistantId?: number | null;
  setShowAssistantsModal?: (show: boolean) => void;
}

export const HistorySidebar = forwardRef<HTMLDivElement, HistorySidebarProps>(
  (
    {
      reset = () => null,
      setShowAssistantsModal = () => null,
      toggled,
      page,
      existingChats,
      currentChatSession,
      assistants,
      folders,
      openedFolders,
      explicitlyUntoggle,
      toggleSidebar,
      removeToggle,
      stopGenerating = () => null,
      showShareModal,
      showDeleteModal,
      showDeleteAllModal,
      backgroundToggled,
      currentAssistantId,
    },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { refreshUser } = useUser();
    const { refreshAssistants } = useAssistants();
    const { popup, setPopup } = usePopup();

    // For determining intial focus state
    const [newFolderId, setNewFolderId] = useState<number | null>(null);

    const currentChatId = currentChatSession?.id;
    const { pinnedAssistants } = useAssistants();

    // NOTE: do not do something like the below - assume that the parent
    // will handle properly refreshing the existingChats
    // useEffect(() => {
    //   router.refresh();
    // }, [currentChatId]);

    const combinedSettings = useContext(SettingsContext);
    if (!combinedSettings) {
      return null;
    }

    const handleNewChat = () => {
      reset();
      const newChatUrl =
        `/${page}` +
        (NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA && currentChatSession
          ? `?assistantId=${currentChatSession.persona_id}`
          : "");
      router.push(newChatUrl);
    };

    return (
      <>
        {popup}
        <div
          ref={ref}
          className={`
            flex
            flex-none
            gap-y-4
            bg-background-sidebar
            w-full
            border-r 
            border-sidebar-border 
            flex 
            flex-col relative
            h-screen
            pt-2
            p-4
            transition-transform 
            `}
        >
          <div className="pl-2">
            <LogoWithText
              showArrow={true}
              toggled={toggled}
              page={page}
              toggleSidebar={toggleSidebar}
              explicitlyUntoggle={explicitlyUntoggle}
            />
          </div>
          {page == "chat" && (
            <div className="px-1 gap-y-1 flex-col text-text-history-sidebar-button flex gap-x-1.5 items-center items-center">
              <Link
                className="w-full px-2 py-1  rounded-md items-center hover:bg-hover cursor-pointer transition-all duration-150 flex gap-x-2"
                href={
                  `/${page}` +
                  (NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA &&
                  currentChatSession?.persona_id
                    ? `?assistantId=${currentChatSession?.persona_id}`
                    : "")
                }
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    return;
                  }
                  if (handleNewChat) {
                    handleNewChat();
                  }
                }}
              >
                <NewChatIcon
                  size={20}
                  className="flex-none text-text-history-sidebar-button"
                />
                <p className="my-auto flex font-normal items-center text-base">
                  Start New Chat
                </p>
              </Link>
            </div>
          )}

          <div>
            <div className="flex font-normal text-sm gap-x-2 leading-normal text-[#6c6c6c] items-center font-normal leading-normal">
              Pinned assistants
            </div>
            <div className="mx-1 flex flex-col gap-y-1 mt-1">
              {pinnedAssistants.length > 0 ? (
                pinnedAssistants.slice(0, 3).map((assistant) => (
                  <button
                    onClick={() => {
                      router.push(
                        buildChatUrl(searchParams, null, assistant.id)
                      );
                    }}
                    className={`cursor-pointer  group hover:bg-hover-light ${
                      currentAssistantId === assistant.id
                        ? "bg-hover-light"
                        : ""
                    } relative flex items-center gap-x-2 py-1 px-2 rounded-md`}
                    key={assistant.id}
                  >
                    <AssistantIcon
                      assistant={assistant}
                      size={16}
                      className="flex-none"
                    />
                    <p className="text-base   text-black">{assistant.name}</p>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        toggleAssistantPinnedStatus(assistant.id, false);
                        await refreshUser();
                        await refreshAssistants();
                      }}
                      className="group-hover:block hidden absolute right-2"
                    >
                      <PinnedIcon
                        size={16}
                        className="text-text-history-sidebar-button"
                      />
                    </button>
                  </button>
                ))
              ) : (
                <div className="flex items-center gap-x-2 py-1 px-2 rounded-md">
                  <p className="text-sm text-black">
                    Pin an assistant to get started
                  </p>
                </div>
              )}
              <button
                onClick={() => setShowAssistantsModal(true)}
                className="cursor-pointer hover:bg-hover-light flex items-center gap-x-2 py-1 px-2 rounded-md"
              >
                <FiMoreHorizontal size={16} className="flex-none" />
                <p className="text-base text-black">More Assistants</p>
              </button>
            </div>
          </div>

          <PagesTab
            setNewFolderId={setNewFolderId}
            newFolderId={newFolderId}
            showDeleteModal={showDeleteModal}
            showShareModal={showShareModal}
            closeSidebar={removeToggle}
            existingChats={existingChats}
            currentChatId={currentChatId}
            folders={folders}
            showDeleteAllModal={showDeleteAllModal}
          />
        </div>
      </>
    );
  }
);
HistorySidebar.displayName = "HistorySidebar";
