"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCookie } from "cookies-next";

// Time constants (in milliseconds)
const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
const REFRESH_THRESHOLD = 10 * 60 * 1000; // Try to refresh when 10 minutes remain

interface AuthMonitorProps {
  children: React.ReactNode;
}

export function AuthMonitor({ children }: AuthMonitorProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Function to parse JWT and get expiration time
  const getTokenExpiration = (): number | null => {
    try {
      const authCookie = getCookie("fastapi-users-auth") as string | undefined;
      if (!authCookie) return null;

      // JWT token has 3 parts separated by dots
      const payload = JSON.parse(atob(authCookie.split(".")[1]));
      return payload.exp * 1000; // Convert from seconds to milliseconds
    } catch (error) {
      console.error("Error parsing auth token:", error);
      return null;
    }
  };

  // Attempt to refresh the token
  const refreshToken = async (): Promise<boolean> => {
    try {
      setIsRefreshing(true);

      // Call your refresh token endpoint here
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include", // Important for cookies
      });

      if (response.ok) {
        console.log("Session refreshed successfully");
        return true;
      } else {
        console.error("Failed to refresh session:", await response.text());
        return false;
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      return false;
    } finally {
      setIsRefreshing(false);
    }
  };

  // Check token expiration and handle status
  const checkTokenExpiration = async () => {
    const expiresAt = getTokenExpiration();

    if (!expiresAt) {
      // No valid token found, redirect to login
      router.push("/login");
      return;
    }

    const remaining = expiresAt - Date.now();
    setTimeRemaining(remaining);

    if (remaining <= 0) {
      // Token expired, redirect to login
      setShowWarning(false);
      router.push("/login");
    } else if (remaining < WARNING_THRESHOLD) {
      // Show warning when less than 5 minutes remaining
      setShowWarning(true);
    } else if (remaining < REFRESH_THRESHOLD && !isRefreshing) {
      // Try refreshing token when less than 10 minutes remaining
      const refreshed = await refreshToken();
      if (refreshed) {
        // Re-check expiration after successful refresh
        checkTokenExpiration();
      }
    } else {
      setShowWarning(false);
    }
  };

  useEffect(() => {
    // Check immediately on mount
    checkTokenExpiration();

    // Set up interval for periodic checking
    const interval = setInterval(() => {
      checkTokenExpiration();
    }, CHECK_INTERVAL);

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, []);

  // Format time remaining for display
  const formatTimeRemaining = (): string => {
    if (!timeRemaining) return "";

    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {children}

      {/* Session expiration warning modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Session Expiring Soon
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Your session will expire in {formatTimeRemaining()}. You'll need
              to log in again to continue.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={async () => {
                  const refreshed = await refreshToken();
                  if (refreshed) {
                    setShowWarning(false);
                    checkTokenExpiration();
                  } else {
                    router.push("/login");
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh session"}
              </button>
              <button
                onClick={() => router.push("/login")}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Log in now
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
