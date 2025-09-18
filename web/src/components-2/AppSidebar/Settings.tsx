"use client";

import React, { useMemo, useContext } from "react";
import { FiLogOut } from "react-icons/fi";
import Link from "next/link";
import { UserRole } from "@/lib/types";
import { checkUserIsNoAuthUser, logout } from "@/lib/user";
import { ANONYMOUS_USER_NAME, LOGOUT_DISABLED } from "@/lib/constants";
import { BellIcon, LightSettingsIcon } from "@/components/icons/icons";
import { NavigationItem, Notification } from "@/app/admin/settings/interfaces";
import DynamicFaIcon, { preloadIcons } from "@/components/icons/DynamicFaIcon";
import useSWR from "swr";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { useUser } from "@/components/user/UserProvider";
import { Avatar } from "@/components/ui/avatar";
import Text from "@/components-2/Text";
import Truncated from "@/components-2/Truncated";
import { SidebarButton } from "@/components-2/AppSidebar/components";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { SettingsContext } from "@/components/settings/SettingsProvider";

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
    <button
      className="flex p-padding-button gap-spacing-interline rounded hover:bg-background-tint-03 w-full"
      onClick={onClick}
    >
      {icon}
      <Text>{label}</Text>
    </button>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
    >
      {content}
    </Link>
  );
}

function DropdownContent() {
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
    <div className="flex flex-col overscroll-contain">
      {dropdownItems.map((item, i) => (
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
              <LightSettingsIcon size={16} className="my-auto text-text-05" />
            }
            label="Curator Panel"
          />
        )
      )}

      <DropdownOption
        icon={<BellIcon size={16} className="my-auto text-text-05" />}
        label={`Notifications ${
          notifications && notifications.length > 0
            ? `(${notifications.length})`
            : ""
        }`}
      />

      {showLogout &&
        (showCuratorPanel || showAdminPanel || dropdownItems.length > 0) && (
          <div className="border-t my-1" />
        )}

      {showLogout && (
        <DropdownOption
          // onClick={handleLogout}
          icon={<FiLogOut size={16} className="my-auto text-text-05" />}
          label="Log out"
        />
      )}
    </div>
  );
}

export interface SettingsProps {
  folded: boolean;
}

function getUsernameFromEmail(email?: string): string {
  if (!email) return ANONYMOUS_USER_NAME;
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return ANONYMOUS_USER_NAME;

  return email.substring(0, atIndex);
}

export default function Settings({ folded }: SettingsProps) {
  const { user } = useUser();

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div>
          <SidebarButton
            icon={({ className }) => (
              <Avatar
                className={`h-[1.2rem] w-[1.2rem] flex items-center justify-center bg-background-neutral-inverted-00 ${className}`}
              >
                <Text inverted secondary={folded}>
                  {user?.email?.[0]?.toUpperCase() || "A"}
                </Text>
              </Avatar>
            )}
            hideTitle={folded}
          >
            <Truncated disableTooltip>
              <Text text04 className="text-left">
                {getUsernameFromEmail(user?.email)}
              </Text>
            </Truncated>
          </SidebarButton>
        </div>
      </HoverCardTrigger>
      <HoverCardContent>
        <DropdownContent />
      </HoverCardContent>
    </HoverCard>
  );
}
