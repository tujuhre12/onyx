"use client";

import { useContext } from "react";
import { SettingsContext } from "../settings/SettingsProvider";
import Image from "next/image";
import { useTheme } from "next-themes";
import { OnyxIcon, OnyxLogoTypeIcon } from "../icons/icons";
import { useEffect } from "react";

export function Logo({
  height,
  width,
  className,
}: {
  height?: number;
  width?: number;
  className?: string;
}) {
  const settings = useContext(SettingsContext);
  const { theme, resolvedTheme } = useTheme();

  // Fallback if theme is "system"
  const effectiveTheme = theme === "system" ? resolvedTheme : theme;

  height = height || 32;
  width = width || 30;

  if (
    !settings ||
    !settings.enterpriseSettings ||
    !settings.enterpriseSettings.use_custom_logo
  ) {
    return (
      <div style={{ height, width }} className={className}>
        <OnyxIcon
          size={height}
          className={`${className} ${
            effectiveTheme === "dark" ? "text-[#fff]" : "text-[#000]"
          }`}
        />
      </div>
    );
  }

  return (
    <div
      style={{ height, width }}
      className={`flex-none relative ${className}`}
    >
      {/* TODO: figure out how to use Next Image here */}
      <img
        src="/api/enterprise-settings/logo"
        alt="Logo"
        style={{ objectFit: "contain", height, width }}
      />
    </div>
  );
}

export function LogoType() {
  const { theme, resolvedTheme } = useTheme();

  // Fallback if theme is "system"
  const effectiveTheme = theme === "system" ? resolvedTheme : theme;

  return (
    <>
      <OnyxLogoTypeIcon
        size={115}
        className={`items-center w-full ${
          effectiveTheme === "dark" ? "text-[#fff]" : "text-[#000]"
        }`}
      />
    </>
  );
}
