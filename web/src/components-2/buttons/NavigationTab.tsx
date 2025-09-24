"use client";

import React, { useState } from "react";
import Link from "next/link";
import Text from "@/components-2/Text";
import { SvgProps } from "@/icons";
import SvgMoreHorizontal from "@/icons/more-horizontal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components-2/buttons/IconButton";
import Truncated from "@/components-2/Truncated";

const textClasses = {
  base: ["text-text-03"],
  danger: ["text-action-danger-05"],
  highlight: ["text-text-04"],
  lowlight: ["text-text-02"],
} as const;

const iconClasses = {
  base: ["stroke-text-03"],
  danger: ["stroke-action-danger-05"],
  highlight: ["stroke-text-03"],
  lowlight: ["stroke-text-02"],
} as const;

export interface NavigationTabProps {
  // Button states:
  folded?: boolean;
  active?: boolean;

  // Button variants:
  danger?: boolean;
  highlight?: boolean;
  lowlight?: boolean;

  // Button properties:
  onClick?: () => void;
  href?: string;
  tooltip?: string;
  popover?: React.ReactNode;

  className?: string;
  icon: React.FunctionComponent<SvgProps>;
  children?: React.ReactNode;
}

export function NavigationTab({
  folded,
  active,

  danger,
  highlight,
  lowlight,

  onClick,
  href,
  tooltip,
  popover,
  className,
  icon: Icon,
  children,
}: NavigationTabProps) {
  // This is used to determine if the `PopoverTrigger` should be shown or not.
  // Do NOT use it for background colours.
  const [hovered, setHovered] = useState(false);
  const [kebabMenuOpen, setKebabMenuOpen] = useState(false);

  const variant = danger
    ? "danger"
    : highlight
      ? "highlight"
      : lowlight
        ? "lowlight"
        : "base";

  const innerContent = (
    <div
      className={cn(
        "flex flex-row justify-center items-center p-spacing-inline gap-spacing-inline rounded-08 cursor-pointer hover:bg-background-tint-03",
        folded ? "w-min" : "w-full",
        active ? "bg-background-tint-00" : "bg-transparent",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseOver={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={href ? undefined : onClick}
    >
      <div
        className={cn(
          "flex-1 h-[1.8rem] flex flex-row items-center p-spacing-inline gap-spacing-interline",
          folded ? "justify-center" : "justify-start"
        )}
      >
        <div className="w-[1.2rem] h-[1.2rem]">
          <Icon className={cn("h-[1.2rem] w-[1.2rem]", iconClasses[variant])} />
        </div>
        {!folded && (
          <Truncated
            side="right"
            offset={40}
            className={cn("text-left", textClasses[variant])}
          >
            {children}
          </Truncated>
        )}
      </div>
      {!folded && popover && (active || hovered || kebabMenuOpen) && (
        <Popover onOpenChange={setKebabMenuOpen}>
          <PopoverTrigger asChild onClick={(event) => event.stopPropagation()}>
            <div>
              <IconButton
                icon={SvgMoreHorizontal}
                internal
                active={kebabMenuOpen}
              />
            </div>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="right"
            avoidCollisions
            sideOffset={8}
          >
            {popover}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  const content =
    folded && tooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{innerContent}</TooltipTrigger>
        <TooltipContent align="center" side="right">
          <Text inverted secondaryBody>
            {tooltip}
          </Text>
        </TooltipContent>
      </Tooltip>
    ) : (
      innerContent
    );

  if (href) return <Link href={href}>{content}</Link>;

  return content;
}
