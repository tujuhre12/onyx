"use client";

import React from "react";
import Text from "@/components-2/Text";
import { cn } from "@/lib/utils";
import { SvgProps } from "@/icons";

interface LineItemProps {
  icon?: React.FunctionComponent<SvgProps>;
  description?: string;
  children?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export default function LineItem({
  icon: Icon,
  description,
  children,
  onClick,
}: LineItemProps) {
  return (
    <button
      className={cn(
        "flex flex-col w-full justify-center items-start p-spacing-interline hover:bg-background-tint-02 rounded-08"
      )}
      onClick={onClick}
    >
      <div className="flex flex-row items-center justify-start w-full gap-spacing-interline">
        {Icon && <Icon className="h-[1rem] w-[1rem] stroke-text-03" />}
        <Text mainMuted text03 className="text-left w-full">
          {children}
        </Text>
      </div>
      {description && (
        <div className="flex flex-row">
          {Icon && (
            <>
              <div className="w-[1rem]" />
              <div className="w-spacing-interline" />
            </>
          )}

          <Text secondaryBody text03 className="">
            {description}
          </Text>
        </div>
      )}
    </button>
  );
}
