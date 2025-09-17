"use client";

import React, { useState } from "react";
import { IconProps } from "@/components/icons/icons";
import Text from "@/components-2/Text";
import Truncated from "@/components-2/Truncated";
import SvgMoreHorizontal from "@/icons/more-horizontal";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface SidebarButtonProps {
  icon?: React.FunctionComponent<IconProps>;
  active?: boolean;
  kebabMenu?: React.ReactNode;
  grey?: boolean;
  hideTitle?: boolean;
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function SidebarButton({
  icon: Icon,
  active,
  kebabMenu,
  grey,
  hideTitle,
  href,
  onClick,
  children,
}: SidebarButtonProps) {
  const [open, setOpen] = useState<boolean>(false);

  const content = (
    <button
      className={`w-full h-min flex flex-row gap-spacing-interline py-spacing-interline px-padding-button hover:bg-background-tint-01 ${active && "bg-background-tint-00"} rounded-08 items-center group ${hideTitle && "justify-center"}`}
      onClick={onClick}
      onMouseLeave={() => setOpen(false)}
    >
      {Icon && (
        <Icon
          className={`h-[1.2rem] mr-[0.4rem] min-w-[1.2rem] ${grey ? "stroke-text-02" : "stroke-text-03"}`}
        />
      )}
      {!hideTitle &&
        (typeof children === "string" ? (
          <Truncated>
            <Text text02={grey} text03={!grey}>
              {children}
            </Text>
          </Truncated>
        ) : (
          <Truncated>{children}</Truncated>
        ))}
      {!hideTitle && <div className="flex-1" />}
      {kebabMenu && !hideTitle && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div
              className="relative group-hover:w-[1rem]"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(!open);
              }}
            >
              <div className="hidden group-hover:flex w-[1rem]" />
              <SvgMoreHorizontal className="absolute right-[0rem] transform -translate-y-1/2 top-[0rem] invisible group-hover:visible stroke-text-03 h-[1rem] min-w-[1rem] cursor-pointer" />
            </div>
          </PopoverTrigger>
          <PopoverContent align="end" side="top">
            {kebabMenu}
          </PopoverContent>
        </Popover>
      )}
    </button>
  );

  if (!href) return content;

  return <Link href={href}>{content}</Link>;
}

export interface SidebarSectionProps {
  title: string;
  children?: React.ReactNode;
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-spacing-inline">
      <Text
        secondary
        text02
        className="px-padding-button sticky top-[0rem] bg-background-tint-02 z-10 py-spacing-interline"
      >
        {title}
      </Text>
      <div>{children}</div>
    </div>
  );
}

function Button(child: string, onClick?: () => void) {
  return (
    <button
      className="flex p-padding-button gap-spacing-interline rounded hover:bg-background-tint-03 w-full"
      onClick={onClick}
    >
      <Text>{child}</Text>
    </button>
  );
}

export interface AgentsMenuProps {
  onNewSession?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export function AgentsMenu({
  isPinned = false,
  onNewSession,
  onTogglePin,
}: AgentsMenuProps) {
  return (
    <div className="flex flex-col">
      {Button("New Session", onNewSession)}
      {Button(isPinned ? "Unpin chat" : "Pin chat", onTogglePin)}
    </div>
  );
}

export interface RecentChatMenuProps {
  onShare?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

export function RecentChatMenu({
  onShare,
  onRename,
  onDelete,
}: RecentChatMenuProps) {
  return (
    <div className="flex flex-col">
      {Button("Share", onShare)}
      {Button("Rename", onRename)}
      {Button("Delete", onDelete)}
    </div>
  );
}
