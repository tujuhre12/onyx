"use client";

import React, { ForwardedRef, forwardRef, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChatSession } from "@/app/chat/interfaces";
import { Folder } from "@/app/chat/components/folders/interfaces";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import {
  DocumentIcon2,
  KnowledgeGroupIcon,
  NewChatIcon,
} from "@/components/icons/icons";
import { PagesTab } from "@/components/sidebar/PagesTab";
import { AgentsTab } from "@/components/sidebar/AgentsTab";
import { pageType } from "@/components/sidebar/types";
import LogoWithText from "@/components/header/LogoWithText";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { useUser } from "@/components/user/UserProvider";
import Text from "@/components-2/Text";

interface HistorySidebarProps {
  liveAssistant?: MinimalPersonaSnapshot | null;
  page: pageType;
  existingChats?: ChatSession[];
  currentChatSession?: ChatSession | null | undefined;
  folders?: Folder[];
  toggleSidebar?: () => void;
  toggled?: boolean;
  removeToggle?: () => void;
  reset?: () => void;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
  explicitlyUntoggle: () => void;
  setShowAssistantsModal: (show: boolean) => void;
  toggleChatSessionSearchModal?: () => void;
}

function _HistorySidebar(
  {
    liveAssistant,
    reset = () => null,
    setShowAssistantsModal = () => null,
    toggled,
    page,
    existingChats,
    currentChatSession,
    folders,
    explicitlyUntoggle,
    toggleSidebar,
    removeToggle,
    showShareModal,
    toggleChatSessionSearchModal,
    showDeleteModal,
  }: HistorySidebarProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  const router = useRouter();
  const { user } = useUser();

  const currentChatId = currentChatSession?.id;

  const combinedSettings = useContext(SettingsContext);
  if (!combinedSettings) {
    return null;
  }

  const handleNewChat = () => {
    reset();
    console.log("currentChatSession", currentChatSession);

    const newChatUrl =
      `/${page}` +
      (currentChatSession
        ? `?assistantId=${currentChatSession.persona_id}`
        : "");
    router.push(newChatUrl);
  };

  return (
    <div
      ref={ref}
      className={`
            flex
            flex-none
            gap-y-4
            bg-background-tint-02
            w-full
            border-r
            flex
            flex-col
            relative
            h-screen
            pt-2
            transition-transform
            `}
    >
      <div className="px-4 pl-2">
        <LogoWithText
          showArrow={true}
          toggled={toggled}
          page={page}
          toggleSidebar={toggleSidebar}
          explicitlyUntoggle={explicitlyUntoggle}
        />
      </div>
      {page == "chat" && (
        <div className="px-4 px-1 -mx-2 gap-y-1 flex-col flex gap-x-1.5 items-center items-center">
          <Link
            className="w-full px-2 py-1 group rounded-md items-center hover:bg-background-tint-01 transition-all duration-150 flex gap-x-2"
            href={
              `/${page}` +
              (currentChatSession
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
            <NewChatIcon size={20} className="flex-none" />
            <Text text03>New Chat</Text>
          </Link>
          <Link
            className="w-full px-2 py-1 rounded-md items-center hover:bg-background-tint-01 transition-all duration-150 flex gap-x-2"
            href="/chat/my-documents"
          >
            <KnowledgeGroupIcon size={20} className="flex-none text-text-03" />
            <Text text03>My Documents</Text>
          </Link>
          {user?.preferences?.shortcut_enabled && (
            <Link
              className="w-full px-2 py-1 rounded-md items-center hover:bg-background-tint-01 cursor-pointer transition-all duration-150 flex gap-x-2"
              href="/chat/input-prompts"
            >
              <DocumentIcon2 size={20} className="flex-none text-text-03" />
              <p className="my-auto flex font-normal items-center text-base">
                Prompt Shortcuts
              </p>
            </Link>
          )}
        </div>
      )}
      <div className="h-full  relative overflow-x-hidden overflow-y-auto">
        <AgentsTab
          liveAssistant={liveAssistant}
          setShowAssistantsModal={setShowAssistantsModal}
        />

        <PagesTab
          toggleChatSessionSearchModal={toggleChatSessionSearchModal}
          showDeleteModal={showDeleteModal}
          showShareModal={showShareModal}
          closeSidebar={removeToggle}
          existingChats={existingChats}
          currentChatId={currentChatId}
          folders={folders}
        />
      </div>
    </div>
  );
}

export const HistorySidebar = React.memo(forwardRef(_HistorySidebar));
HistorySidebar.displayName = "HistorySidebar";
