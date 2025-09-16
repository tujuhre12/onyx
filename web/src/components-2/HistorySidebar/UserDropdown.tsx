"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { FiLogOut } from "react-icons/fi";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { UserRole } from "@/lib/types";
import { checkUserIsNoAuthUser, logout } from "@/lib/user";
import { LOGOUT_DISABLED } from "@/lib/constants";
import { BellIcon, LightSettingsIcon } from "@/components/icons/icons";
import { pageType } from "@/components/sidebar/types";
import { NavigationItem, Notification } from "@/app/admin/settings/interfaces";
import DynamicFaIcon, { preloadIcons } from "@/components/icons/DynamicFaIcon";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { useUser } from "@/components/user/UserProvider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar } from "@/components/ui/avatar";
import Text from "@/components-2/Text";
import Truncated from "@/components-2/Truncated";
import { SidebarButton } from "@/components-2/HistorySidebar/components";

interface DropdownOptionProps {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  openInNewTab?: boolean;
}

function DropdownOption({
  href,
  onClick,
  icon,
  label,
  openInNewTab,
}: DropdownOptionProps) {
  const content = (
    <div className="flex py-1.5 text-sm px-2 gap-x-2 text-sm cursor-pointer rounded hover:bg-background-tint-03">
      {icon}
      <Text>{label}</Text>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        target={openInNewTab ? "_blank" : undefined}
        rel={openInNewTab ? "noopener noreferrer" : undefined}
      >
        {content}
      </Link>
    );
  } else {
    return <div onClick={onClick}>{content}</div>;
  }
}

export interface UserDropdownProps {
  user: any;
  combinedSettings: any;
  page: pageType;
}

export default function UserDropdown({
  user,
  combinedSettings,
  page,
}: UserDropdownProps) {
  const { isCurator } = useUser();
  const [userInfoVisible, setUserInfoVisible] = useState(false);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showNotifications, setShowNotifications] = useState(false);

  const customNavItems: NavigationItem[] = useMemo(
    () => combinedSettings?.enterpriseSettings?.custom_nav_items || [],
    [combinedSettings]
  );
  const {
    data: notifications,
    error,
    mutate: refreshNotifications,
  } = useSWR<Notification[]>("/api/notifications", errorHandlingFetcher);

  useEffect(() => {
    const iconNames = customNavItems
      .map((item) => item.icon)
      .filter((icon) => icon) as string[];
    preloadIcons(iconNames);
  }, [customNavItems]);

  function handleLogout() {
    logout().then((isSuccess) => {
      if (!isSuccess) {
        alert("Failed to logout");
        return;
      }

      // Construct the current URL
      const currentUrl = `${pathname}${
        searchParams?.toString() ? `?${searchParams.toString()}` : ""
      }`;

      // Encode the current URL to use as a redirect parameter
      const encodedRedirect = encodeURIComponent(currentUrl);

      // Redirect to login page with the current page as a redirect parameter
      router.push(`/auth/login?next=${encodedRedirect}`);
    });
  }

  const showAdminPanel = !user || user.role === UserRole.ADMIN;
  const showCuratorPanel = user && isCurator;
  const showLogout =
    user && !checkUserIsNoAuthUser(user.id) && !LOGOUT_DISABLED;

  function onOpenChange(open: boolean) {
    setUserInfoVisible(open);
    setShowNotifications(false);
  }

  return (
    <Popover open={userInfoVisible} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <SidebarButton
          icon={() => (
            <Avatar className="h-[1.7rem] w-[1.7rem] flex items-center justify-center bg-background-neutral-inverted-00">
              <Text inverted>{user?.email?.[0]?.toUpperCase() || "A"}</Text>
            </Avatar>
          )}
          title={
            <Truncated disableTooltip>
              <Text text04>{user?.email}</Text>
            </Truncated>
          }
          noKebabMenu
        />
      </PopoverTrigger>
      <PopoverContent className="w-[175px] p-2">
        <div className="flex flex-col max-h-96 overflow-y-auto p-1 overscroll-contain">
          {customNavItems.map((item, i) => (
            <DropdownOption
              key={i}
              href={item.link}
              icon={
                item.svg_logo ? (
                  <div
                    className="
                  h-4
                  w-4
                  my-auto
                  overflow-hidden
                  flex
                  items-center
                  justify-center
                "
                    aria-label={item.title}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="100%"
                      height="100%"
                      preserveAspectRatio="xMidYMid meet"
                      dangerouslySetInnerHTML={{ __html: item.svg_logo }}
                    />
                  </div>
                ) : (
                  <DynamicFaIcon
                    name={item.icon!}
                    className="h-4 w-4 my-auto text-text-05"
                  />
                )
              }
              label={item.title}
              openInNewTab
            />
          ))}

          {showAdminPanel ? (
            <DropdownOption
              href="/admin/indexing/status"
              icon={
                <LightSettingsIcon size={16} className="my-auto text-text-05" />
              }
              label="Admin Panel"
            />
          ) : (
            showCuratorPanel && (
              <DropdownOption
                href="/admin/indexing/status"
                icon={
                  <LightSettingsIcon
                    size={16}
                    className="my-auto text-text-05"
                  />
                }
                label="Curator Panel"
              />
            )
          )}

          <DropdownOption
            onClick={() => {
              setUserInfoVisible(true);
              setShowNotifications(true);
            }}
            icon={<BellIcon size={16} className="my-auto text-text-05" />}
            label={`Notifications ${
              notifications && notifications.length > 0
                ? `(${notifications.length})`
                : ""
            }`}
          />

          {showLogout &&
            (showCuratorPanel ||
              showAdminPanel ||
              customNavItems.length > 0) && <div className="border-t my-1" />}

          {showLogout && (
            <DropdownOption
              onClick={handleLogout}
              icon={<FiLogOut size={16} className="my-auto text-text-05" />}
              label="Log out"
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
