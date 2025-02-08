"use client";

import { useContext } from "react";
import { SettingsContext } from "../settings/SettingsProvider";
import Image from "next/image";
import { useTheme } from "next-themes";
import { OnyxLogoTypeIcon } from "../icons/icons";

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

  height = height || 32;
  width = width || 30;
  const isDarkMode = useTheme().theme === "dark";

  if (
    !settings ||
    !settings.enterpriseSettings ||
    !settings.enterpriseSettings.use_custom_logo
  ) {
    return (
      <div style={{ height, width }} className={className}>
        <Image
          src={isDarkMode ? "/logo-dark.png" : "/logo.png"}
          alt="Logo"
          width={width}
          height={height}
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
  const theme = useTheme();
  return (
    <OnyxLogoTypeIcon
      size={115}
      className={` items-center w-full ${
        theme.theme === "dark" ? "text-[#fff]" : "text-[#000]"
      }`}
    />
  );
}
