"use client";

import React, { useMemo, useContext, useState } from "react";
import { UserRole } from "@/lib/types";
import { checkUserIsNoAuthUser, logout } from "@/lib/user";
import { ANONYMOUS_USER_NAME, LOGOUT_DISABLED } from "@/lib/constants";
import { NavigationItem, Notification } from "@/app/admin/settings/interfaces";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { useUser } from "@/components/user/UserProvider";
import { Avatar } from "@/components/ui/avatar";
import Text from "@/components-2/Text";
import Truncated from "@/components-2/Truncated";
import { MenuButton, SidebarButton } from "@/sections/AppSidebar/components";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import SvgSettings from "@/icons/settings";
import SvgLogOut from "@/icons/log-out";
import SvgBell from "@/icons/bell";

function getUsernameFromEmail(email?: string): string {
  if (!email) return ANONYMOUS_USER_NAME;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return ANONYMOUS_USER_NAME;

  return email.substring(0, atIndex);
}

export interface SettingsProps {
  folded: boolean;
}

export default function Settings({ folded }: SettingsProps) {
  const [open, setOpen] = useState(false);
  const { user, isCurator } = useUser();
  const combinedSettings = useContext(SettingsContext);
  const dropdownItems: NavigationItem[] = useMemo(
    () => combinedSettings?.enterpriseSettings?.custom_nav_items || [],
    [combinedSettings]
  );
  const {
    data: notifications,
    error,
    mutate: refreshNotifications,
  } = useSWR<Notification[]>("/api/notifications", errorHandlingFetcher);

  const showAdminPanel = !user || user.role === UserRole.ADMIN;
  const showCuratorPanel = user && isCurator;
  const showLogout =
    user && !checkUserIsNoAuthUser(user.id) && !LOGOUT_DISABLED;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div>
          <SidebarButton
            icon={({ className }) => (
              <Avatar
                className={`h-[1.2rem] w-[1.2rem] flex items-center justify-center bg-background-neutral-inverted-00 ${className}`}
              >
                <Text inverted>{user?.email?.[0]?.toUpperCase() || "A"}</Text>
              </Avatar>
            )}
            hideTitle={folded}
            active={open}
          >
            <Truncated disableTooltip>
              <Text text04 className="text-left">
                {getUsernameFromEmail(user?.email)}
              </Text>
            </Truncated>
          </SidebarButton>
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" side="right">
        <div className="flex flex-col gap-spacing-inline overscroll-contain">
          {dropdownItems.map((item, index) => (
            <MenuButton key={index} href={item.link}>
              {item.title}
            </MenuButton>
          ))}

          {showAdminPanel ? (
            <MenuButton href="/admin/indexing/status" icon={SvgSettings}>
              Admin Panel
            </MenuButton>
          ) : (
            showCuratorPanel && (
              <MenuButton href="/admin/indexing/status" icon={SvgSettings}>
                Curator Panel
              </MenuButton>
            )
          )}

          <MenuButton icon={SvgBell}>
            {`Notifications ${(notifications && notifications.length) || 0 > 0 ? `(${notifications!.length})` : ""}`}
          </MenuButton>

          {showLogout && (
            <>
              {(showCuratorPanel ||
                showAdminPanel ||
                dropdownItems.length > 0) && (
                <div className="border-b mx-padding-button" />
              )}
              <MenuButton icon={SvgLogOut}>Log out</MenuButton>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
