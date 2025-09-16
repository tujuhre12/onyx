"use client";

import React from "react";
import { IconProps } from "@/components/icons/icons";
import Text from "@/components-2/Text";
import Truncated from "@/components-2/Truncated";
import SvgMoreHorizontal from "@/icons/more-horizontal";

export interface SidebarButtonProps {
  icon: React.FunctionComponent<IconProps>;
  title: React.ReactNode;
  active?: boolean;
  noKebabMenu?: boolean;
  grey?: boolean;
}

export function SidebarButton({
  icon: Icon,
  title,
  active,
  noKebabMenu,
  grey,
}: SidebarButtonProps) {
  return (
    <button
      className={`w-full flex flex-row gap-spacing-interline p-spacing-interline hover:bg-background-tint-01 ${active && "bg-background-tint-00"} rounded-08 items-center group`}
    >
      <Icon
        className={`w-[1.2rem] ${grey ? "stroke-text-02" : "stroke-text-03"}`}
      />
      {typeof title === "string" ? (
        <Truncated tooltipSide="top">
          <Text text02={grey} text03={!grey}>
            {title}
          </Text>
        </Truncated>
      ) : (
        title
      )}
      <div className="flex-1" />
      {!noKebabMenu && (
        <SvgMoreHorizontal className="hidden group-hover:flex stroke-text-03 h-[1rem] min-w-[1rem]" />
      )}
    </button>
  );
}

export interface SidebarSectionProps {
  title: string;
  children?: React.ReactNode;
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="flex flex-col gap-spacing-interline">
      <Text secondary text02 className="px-padding-button">
        {title}
      </Text>
      <div className="">{children}</div>
    </div>
  );
}
