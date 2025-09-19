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
import SvgEdit from "@/icons/edit";
import SvgShare from "@/icons/share";
import SvgTrash from "@/icons/trash";
import { SvgProps } from "@/icons";

export interface SidebarButtonProps {
  className?: string;
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
  className,
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
      className={`w-full flex flex-row gap-spacing-interline py-spacing-interline px-padding-button hover:bg-background-tint-01 ${active && "bg-background-tint-00"} ${open && "bg-background-tint-01"} rounded-08 items-center group ${hideTitle && "justify-center"} ${className}`}
      onClick={onClick}
    >
      {Icon && (
        <Icon
          className={`h-[1.2rem] min-w-[1.2rem] ${!hideTitle && "mr-[0.4rem]"} ${grey ? "stroke-text-02" : "stroke-text-03"}`}
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
              className={`relative h-[1.75rem]`}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(!open);
              }}
            >
              <div
                className={`h-[1.75rem] w-[1.75rem] ${open ? "flex" : "hidden group-hover:flex"} w-[1rem]`}
              />
              <div
                className={`absolute inset-0 w-full h-full flex flex-col justify-center items-center rounded-08 hover:bg-background-tint-00 ${open && "bg-background-tint-00"}`}
              >
                <SvgMoreHorizontal
                  className={`h-[1rem] min-w-[1rem] ${open ? "visible" : "invisible group-hover:visible"} stroke-text-03`}
                />
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent align="start" side="right">
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

export interface ButtonProps {
  children?: string;
  onClick?: () => void;
  href?: string;
  icon?: React.FunctionComponent<SvgProps>;
  textClassName?: string;
  iconClassName?: string;
}

export function Button({
  children,
  onClick,
  href,
  icon: Icon,
  textClassName,
  iconClassName,
}: ButtonProps) {
  const content = (
    <button
      className="flex p-padding-button gap-spacing-interline rounded-08 hover:bg-background-tint-02 w-full"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {Icon && (
        <Icon
          className={`h-[1.2rem] min-w-[1.2rem] stroke-text-04 ${iconClassName}`}
        />
      )}
      <Text text04 className={textClassName}>
        {children}
      </Text>
    </button>
  );

  if (!href) return content;

  return <Link href={href}>{content}</Link>;
}

export interface AgentsMenuProps {
  pinned?: boolean;
  onTogglePin: () => void;
}

export function AgentsMenu({ pinned, onTogglePin }: AgentsMenuProps) {
  return (
    <div className="flex flex-col gap-spacing-inline">
      <Button onClick={onTogglePin}>
        {pinned ? "Unpin chat" : "Pin chat"}
      </Button>
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
    <div className="flex flex-col gap-spacing-inline">
      <Button onClick={onShare} icon={SvgShare}>
        Share
      </Button>
      <Button onClick={onRename} icon={SvgEdit}>
        Rename
      </Button>
      <div className="border-b mx-spacing-interline" />
      <Button
        onClick={onDelete}
        icon={SvgTrash}
        iconClassName="!stroke-action-danger-05"
        textClassName="!text-action-danger-05"
      >
        Delete
      </Button>
    </div>
  );
}
