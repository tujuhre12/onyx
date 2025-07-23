"use client";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect } from "react";
import React, { createContext, useContext, useState, useMemo } from "react";
import { HistorySidebar } from "./chat/sessionSidebar/HistorySidebar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

// PostHog context

const isPostHogEnabled = !!(
  process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST
);

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isPostHogEnabled) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST!,
        person_profiles: "identified_only",
        capture_pageview: false,
      });
    }
  }, []);

  if (!isPostHogEnabled) {
    return <>{children}</>;
  }

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}

// AppMode context

export type AppMode = "auto" | "search" | "chat";

interface AppModeContextType {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

type AppProviderProps = { children: React.ReactNode };

export function AppProvider({ children }: AppProviderProps) {
  // Sidebar visibility state (controlled here only)
  const [sidebarVisible, setSidebarVisible] = useState(false);
  // App mode state
  const [appMode, setAppMode] = useState<AppMode>("auto");

  // Memoize context value
  const appModeCtx = useMemo(() => ({ appMode, setAppMode }), [appMode]);

  return (
    <AppModeContext.Provider value={appModeCtx}>
      <div className="flex h-screen w-screen">
        {/* Sidebar (visibility controlled here) */}
        <div
          className={`transition-all duration-300 ${sidebarVisible ? "w-[250px]" : "w-0"} overflow-hidden`}
        >
          <HistorySidebar
            page="chat"
            explicitlyUntoggle={() => setSidebarVisible(false)}
            setShowAssistantsModal={() => {}}
            toggled={sidebarVisible}
            toggleSidebar={() => setSidebarVisible((v) => !v)}
          />
        </div>
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* App mode dropdown */}
          <div className="p-2 flex items-center gap-2 border-b bg-neutral-50 dark:bg-neutral-900">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="border rounded px-3 py-1 bg-white dark:bg-neutral-800">
                  Mode: {appMode.charAt(0).toUpperCase() + appMode.slice(1)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value={appMode}
                  onValueChange={(v) => setAppMode(v as AppMode)}
                >
                  <DropdownMenuRadioItem value="auto">
                    Auto
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="search">
                    Search
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="chat">
                    Chat
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              className="ml-2 px-2 py-1 border rounded"
              onClick={() => setSidebarVisible((v) => !v)}
            >
              {sidebarVisible ? "Hide" : "Show"} History
            </button>
          </div>
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const ctx = useContext(AppModeContext);
  if (!ctx) throw new Error("useAppMode must be used within AppProvider");
  return ctx;
}
