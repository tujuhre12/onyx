"use client";

import React, { useState } from "react";
import { UserDropdown } from "@/components/UserDropdown";
import { UserSettingsModal } from "@/app/chat/modal/UserSettingsModal";
import { useChatContext } from "@/components/context/ChatContext";
import { useUser } from "@/components/user/UserProvider";
import { usePopup } from "@/components/admin/connectors/Popup";
import { useFederatedOAuthStatus } from "@/lib/hooks/useFederatedOAuthStatus";
import { useLlmManager } from "@/lib/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon, SparkleIcon } from "@/components/icons/icons";
import { useSidebar } from "@/components/context/SidebarProvider";
import { MagnifyingIcon, ChatIcon } from "@/components/icons/icons";

const dropdownItems = [
  {
    title: "Auto",
    description: "Automatic Search/Chat Mode",
    icon: SparkleIcon,
  },
  {
    title: "Search",
    description: "Quick Search for Documents",
    icon: MagnifyingIcon,
  },
  {
    title: "Chat",
    description: "Conversation and Research with Follow-Up Questions",
    icon: ChatIcon,
  },
];

interface DropdownItemProps {
  title: string;
  description: string;
  onClick: () => void;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
}

function DropdownItem({
  title,
  description,
  onClick,
  icon: Icon,
}: DropdownItemProps) {
  return (
    <DropdownMenuItem onClick={onClick} className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center flex-1 flex-col h-full">
          {Icon && <Icon size={18} />}
        </div>
        <div className="flex flex-col">
          <span className="text-md">{title}</span>
          <span className="text-xs text-subtle">{description}</span>
        </div>
      </div>
    </DropdownMenuItem>
  );
}

export function Header() {
  const [userSettingsOpen, setUserSettingsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("Auto");
  const { sidebarVisible } = useSidebar();
  const { llmProviders, ccPairs } = useChatContext();
  const { user } = useUser();
  const { popup, setPopup } = usePopup();
  const {
    connectors: federatedConnectors,
    refetch: refetchFederatedConnectors,
  } = useFederatedOAuthStatus();

  const llmManager = useLlmManager(llmProviders, undefined, undefined);

  const toggleUserSettings = () => {
    setUserSettingsOpen(!userSettingsOpen);
  };

  const selectedItem = dropdownItems.find(
    (item) => item.title === selectedMode
  );

  console.log(sidebarVisible);

  return (
    <>
      <div className="flex w-full items-center justify-start gap-2 z-50 px-4 py-2">
        <div
          className={`flex flex-1 transition-transform duration-300 ease-in-out ${sidebarVisible ? "translate-x-0" : "translate-x-[130px]"}`}
        >
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent-background-hovered transition-colors duration-200 ease-in-out">
              {selectedItem?.icon && <selectedItem.icon size={16} />}
              <span className="font-medium">{selectedMode}</span>
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {dropdownItems.map((item) => (
                <DropdownItem
                  key={item.title}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  onClick={() => setSelectedMode(item.title)}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex">
          <UserDropdown
            hideUserDropdown={false}
            toggleUserSettings={toggleUserSettings}
          />
        </div>
      </div>
      {userSettingsOpen && (
        <UserSettingsModal
          setPopup={setPopup}
          setCurrentLlm={(newLlm) => llmManager.updateCurrentLlm(newLlm)}
          defaultModel={user?.preferences.default_model!}
          llmProviders={llmProviders}
          ccPairs={ccPairs}
          federatedConnectors={federatedConnectors}
          refetchFederatedConnectors={refetchFederatedConnectors}
          onClose={() => setUserSettingsOpen(false)}
        />
      )}
      {popup}
    </>
  );
}
