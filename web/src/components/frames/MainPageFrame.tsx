"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { useChatContext } from "@/components/context/ChatContext";
import { useSidebar } from "@/components/context/SidebarProvider";
import { useSidebarShortcut } from "@/lib/browserUtilities";
import { NewChatIcon } from "@/components/icons/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { UserDropdown } from "@/components/UserDropdown";
import CollapsibleLogo from "../logo/CollapsibleLogo";

interface MainPageFrameProps {
  children: React.ReactNode;
}

export default function MainPageFrame({ children }: MainPageFrameProps) {
  const { chatSessions, folders } = useChatContext();
  const {
    sidebarElementRef,
    sidebarPinned,
    sidebarVisible,
    toggleSidebarPinned,
  } = useSidebar();

  useSidebarShortcut(toggleSidebarPinned);

  return (
    <div className="flex relative overflow-x-hidden overscroll-contain flex-col w-full h-screen">
      <div className="z-50 fixed top-[16px] left-[16px]">
        <CollapsibleLogo />
      </div>
      <div className="fixed top-0 w-full"></div>
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
      </main>
    </div>
  );
}
