"use client";

import React, { useState } from "react";
import { UserDropdown } from "@/components/UserDropdown";
import { FiShare2 } from "react-icons/fi";
import { pageType } from "@/components/sidebar/types";

interface HeaderProps {
  onShareClick?: () => void;
}

export function Header({ onShareClick }: HeaderProps) {
  const [showUserSettings, setShowUserSettings] = useState(false);

  const toggleUserSettings = () => {
    setShowUserSettings(!showUserSettings);
  };

  return (
    <div className="flex items-center justify-end gap-2 px-4 py-2 h-16">
      <UserDropdown page="chat" toggleUserSettings={toggleUserSettings} />
    </div>
  );
}
