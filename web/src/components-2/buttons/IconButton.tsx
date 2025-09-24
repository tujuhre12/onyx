"use client";

import React, { useState } from "react";
import { SvgProps } from "@/icons";
import { cn, trinaryLogic } from "@/lib/utils";

const buttonClasses = {
  primary: {
    base: ["bg-theme-primary-05", "hover:bg-theme-primary-04"],
    active: ["!bg-theme-primary-06"],
    disabled: ["!bg-background-neutral-04"],
  },
  secondary: {
    base: ["bg-background-tint-02", "hover:bg-background-tint-02", "border"],
    active: ["!bg-background-tint-00"],
    disabled: ["!bg-background-neutral-03"],
  },
  tertiary: {
    base: ["bg-transparent", "hover:bg-background-tint-02"],
    active: ["!bg-background-tint-00"],
    disabled: ["!bg-background-neutral-02"],
  },
  internal: {
    base: ["bg-transparent", "hover:bg-background-tint-00"],
    active: ["!bg-background-tint-00"],
    disabled: ["!bg-transparent"],
  },
} as const;

const iconClasses = {
  primary: {
    base: ["stroke-text-inverted-05"],
    active: ["!stroke-text-inverted-05"],
    disabled: ["!stroke-text-inverted-05"],
  },
  secondary: {
    base: ["stroke-text-03"],
    active: ["!stroke-text-05"],
    disabled: ["!stroke-text-01"],
  },
  tertiary: {
    base: ["stroke-text-03"],
    active: ["!stroke-text-05"],
    disabled: ["!stroke-text-01"],
  },
  internal: {
    base: ["stroke-text-02", "group-hover:stroke-text-04"],
    active: ["!stroke-text-05"],
    disabled: ["!stroke-text-01"],
  },
} as const;

export interface IconButtonProps
  extends React.HTMLAttributes<HTMLButtonElement> {
  // Button states:
  active?: boolean;
  disabled?: boolean;

  // Button variant:
  primary?: boolean;
  secondary?: boolean;
  tertiary?: boolean;
  internal?: boolean;

  // Button properties:
  onClick?: () => void;
  icon: React.FunctionComponent<SvgProps>;
}

export function IconButton({
  active,
  disabled,

  primary,
  secondary,
  tertiary,
  internal,

  onClick,
  icon: Icon,

  ...props
}: IconButtonProps) {
  const state = active ? "active" : disabled ? "disabled" : "base";
  const variant = primary
    ? "primary"
    : secondary
      ? "secondary"
      : tertiary
        ? "tertiary"
        : internal
          ? "internal"
          : "primary";
  const buttonClassNames = buttonClasses[variant];
  const iconClassNames = iconClasses[variant];

  return (
    <button
      className={cn(
        "flex items-center justify-center rounded-08 group",
        buttonClassNames.base,
        buttonClassNames[state],
        internal ? "p-spacing-inline" : "p-spacing-interline",
        disabled && "cursor-not-allowed"
      )}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...props}
    >
      <Icon
        className={cn(
          "h-[1rem] w-[1rem]",
          iconClassNames.base,
          iconClassNames[state]
        )}
      />
    </button>
  );
}
