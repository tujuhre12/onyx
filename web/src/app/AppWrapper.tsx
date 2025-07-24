"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useChatContext } from "@/components/context/ChatContext";
import { pageType } from "@/components/sidebar/types";
import { useSidebar } from "@/components/context/SidebarProvider";
import { useSidebarShortcut } from "@/lib/browserUtilities";
import FixedLogo from "@/components/logo/FixedLogo";
import AssistantModal from "./assistants/mine/AssistantModal";
import { NewChatIcon } from "@/components/icons/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { UserDropdown } from "@/components/UserDropdown";

interface AppWrapperProps {
  children: React.ReactNode;
}

export default function AppWrapper({ children }: AppWrapperProps) {
  const { chatSessions, folders } = useChatContext();
  const [showAssistantsModal, setShowAssistantsModal] = useState(false);
  const {
    sidebarElementRef,
    sidebarPinned,
    sidebarVisible,
    toggleSidebarPinned,
  } = useSidebar();

  useSidebarShortcut(toggleSidebarPinned);

  return (
    <div className="flex relative overflow-x-hidden overscroll-contain flex-col w-full h-screen">
      <div
        ref={sidebarElementRef}
        className={`
          flex-none
          fixed
          left-0
          z-30
          bg-background-100
          h-screen
          transition-all
          bg-opacity-80
          duration-300
          ease-in-out
          ${
            sidebarVisible
              ? "opacity-100 w-[250px] translate-x-0"
              : "opacity-0 w-[200px] pointer-events-none -translate-x-10"
          }
        `}
      >
        <div className="w-full relative">
          <Sidebar
            setShowAssistantsModal={setShowAssistantsModal}
            page={"chat" as pageType}
            existingChats={chatSessions}
            currentChatSession={null}
            folders={folders}
            sidebarVisible={sidebarVisible}
            sidebarPinned={sidebarPinned}
            toggleSidebarPinned={toggleSidebarPinned}
          />
        </div>
      </div>
      <main
        className={`flex flex-col h-full transition-all duration-300 ease-in-out ${sidebarPinned ? "pl-[250px]" : ""}`}
      >
        {children}
        {showAssistantsModal && (
          <AssistantModal hideModal={() => setShowAssistantsModal(false)} />
        )}
        <FixedLogo backgroundToggled={false} />
        <TooltipProvider delayDuration={1000}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                className={`fixed top-[16px] left-[140px] z-50 mobile:hidden transition-all duration-300 ease-in-out ${
                  sidebarVisible
                    ? "opacity-0 pointer-events-none scale-95"
                    : "opacity-100 pointer-events-auto scale-100"
                }`}
                href="/chat"
              >
                <NewChatIcon
                  className="text-text-700 hover:text-text-600"
                  size={24}
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="fixed top-[16px] right-[16px]">
          <UserDropdown
            page="chat"
            hideUserDropdown={false}
            toggleUserSettings={() => {}}
          />
        </div>
      </main>
    </div>
  );
}
