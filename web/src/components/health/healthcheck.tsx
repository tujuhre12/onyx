"use client";

import { errorHandlingFetcher, RedirectError } from "@/lib/fetcher";
import useSWR from "swr";
import { Modal } from "../Modal";
import { useCallback, useEffect, useState } from "react";
import { getSecondsUntilExpiration } from "@/lib/time";
import { User } from "@/lib/types";
import { mockedRefreshToken, refreshToken } from "./refreshUtils";
import { NEXT_PUBLIC_CUSTOM_REFRESH_URL } from "@/lib/constants";
import { Button } from "../ui/button";
import { logout } from "@/lib/user";
import { usePathname, useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { SUPPRESS_EXPIRATION_WARNING_COOKIE_NAME } from "../resizable/constants";

export const HealthCheckBanner = () => {
  const router = useRouter();
  const { error } = useSWR("/api/health", errorHandlingFetcher);
  const [expired, setExpired] = useState(false);
  const [secondsUntilExpiration, setSecondsUntilExpiration] = useState<
    number | null
  >(null);

  const [showExpirationWarning, setShowExpirationWarning] = useState(false);
  const pathname = usePathname();

  const {
    data: user,
    mutate: mutateUser,
    error: userError,
  } = useSWR<User>("/api/me", errorHandlingFetcher);

  // Handle 403 errors from the /api/me endpoint
  useEffect(() => {
    if (userError && userError.status === 403) {
      console.log("Received 403 from /api/me, logging out user");

      logout().then(() => {
        if (!pathname.includes("/auth")) {
          router.push("/auth/login");
        }
      });
    }
  }, [userError, router]);

  const updateExpirationTime = useCallback(async () => {
    const updatedUser = await mutateUser();

    if (updatedUser) {
      const seconds = getSecondsUntilExpiration(updatedUser);
      setSecondsUntilExpiration(seconds);
      console.debug(`Updated seconds until expiration:! ${seconds}`);
    }
  }, [mutateUser]);

  useEffect(() => {
    updateExpirationTime();
  }, [user, updateExpirationTime]);

  useEffect(() => {
    if (NEXT_PUBLIC_CUSTOM_REFRESH_URL) {
      const refreshUrl = NEXT_PUBLIC_CUSTOM_REFRESH_URL;
      let refreshIntervalId: NodeJS.Timer;
      let expireTimeoutId: NodeJS.Timeout;

      const attemptTokenRefresh = async () => {
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
          try {
            // NOTE: This is a mocked refresh token for testing purposes.
            // const refreshTokenData = mockedRefreshToken();

            const refreshTokenData = await refreshToken(refreshUrl);
            if (!refreshTokenData) {
              throw new Error("Failed to refresh token");
            }

            const response = await fetch(
              "/api/enterprise-settings/refresh-token",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(refreshTokenData),
              }
            );
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 4000));

            await mutateUser(undefined, { revalidate: true });
            updateExpirationTime();
            break; // Success - exit the retry loop
          } catch (error) {
            console.error(
              `Error refreshing token (attempt ${
                retryCount + 1
              }/${maxRetries}):`,
              error
            );
            retryCount++;

            if (retryCount === maxRetries) {
              console.error("Max retry attempts reached");
            } else {
              // Wait before retrying (exponential backoff)
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, retryCount) * 1000)
              );
            }
          }
        }
      };

      const scheduleRefreshAndExpire = () => {
        if (secondsUntilExpiration !== null) {
          const refreshInterval = 60 * 15; // 15 mins
          refreshIntervalId = setInterval(
            attemptTokenRefresh,
            refreshInterval * 1000
          );

          const timeUntilExpire = (secondsUntilExpiration + 10) * 1000;
          expireTimeoutId = setTimeout(() => {
            console.debug("Session expired. Setting expired state to true.");
            setExpired(true);
          }, timeUntilExpire);

          // if we're going to timeout before the next refresh, kick off a refresh now!
          if (secondsUntilExpiration < refreshInterval) {
            attemptTokenRefresh();
          }
        }
      };

      scheduleRefreshAndExpire();

      return () => {
        clearInterval(refreshIntervalId);
        clearTimeout(expireTimeoutId);
      };
    } else {
      let warningTimeoutId: NodeJS.Timeout;
      let expireTimeoutId: NodeJS.Timeout;

      const scheduleWarningAndExpire = () => {
        if (secondsUntilExpiration !== null) {
          const warningThreshold = 5 * 6000; // 5 minutes

          // Check if there's a cookie to suppress the warning
          const suppressWarning = Cookies.get(
            SUPPRESS_EXPIRATION_WARNING_COOKIE_NAME
          );

          if (suppressWarning) {
            console.debug("Suppressing expiration warning due to cookie");
            setShowExpirationWarning(false);
          } else if (secondsUntilExpiration <= warningThreshold) {
            setShowExpirationWarning(true);
          } else {
            const timeUntilWarning =
              (secondsUntilExpiration - warningThreshold) * 1000;
            warningTimeoutId = setTimeout(() => {
              // Check again for cookie when timeout fires
              if (!Cookies.get(SUPPRESS_EXPIRATION_WARNING_COOKIE_NAME)) {
                console.debug("Session about to expire. Showing warning.");
                setShowExpirationWarning(true);
              }
            }, timeUntilWarning);
          }

          const timeUntilExpire = (secondsUntilExpiration + 10) * 1000;
          expireTimeoutId = setTimeout(() => {
            console.debug("Session expired. Setting expired state to true.");
            setShowExpirationWarning(false);
            setExpired(true);
            // Remove the cookie when session actually expires
            Cookies.remove(SUPPRESS_EXPIRATION_WARNING_COOKIE_NAME);
          }, timeUntilExpire);
        }
      };

      scheduleWarningAndExpire();

      return () => {
        clearTimeout(warningTimeoutId);
        clearTimeout(expireTimeoutId);
      };
    }
  }, [secondsUntilExpiration, user, mutateUser, updateExpirationTime]);

  // Function to handle the "Continue Session" button
  const handleContinueSession = () => {
    // Set a cookie that will expire when the session expires
    if (secondsUntilExpiration) {
      // Calculate expiry in days (js-cookie uses days for expiration)
      const expiryDays = secondsUntilExpiration / (60 * 60 * 24);
      Cookies.set(SUPPRESS_EXPIRATION_WARNING_COOKIE_NAME, "true", {
        expires: expiryDays,
        path: "/",
      });

      console.debug(`Set cookie to suppress warnings for ${expiryDays} days`);
      setShowExpirationWarning(false);
    }
  };

  if (showExpirationWarning) {
    return (
      <Modal
        width="w-1/3"
        className="overflow-y-hidden flex flex-col"
        title="Your Session Is About To Expire"
      >
        <div className="flex flex-col gap-y-4">
          <p className="text-sm">
            Your session will expire soon (in {secondsUntilExpiration} seconds).
            Would you like to continue your session or log out?
          </p>
          <div className="flex flex-row gap-x-2 justify-end mt-4">
            <Button onClick={handleContinueSession}>Continue Session</Button>
            <Button
              onClick={async () => {
                await logout();
                router.push("/auth/login");
              }}
              variant="outline"
            >
              Log Out
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!error && !expired) {
    return null;
  }

  console.debug(
    `Rendering HealthCheckBanner. Error: ${error}, Expired: ${expired}`
  );

  if (error instanceof RedirectError || expired) {
    if (!pathname.includes("/auth")) {
      alert(pathname);
      router.push("/auth/login");
    }
    return null;
  } else {
    return (
      <div className="fixed top-0 left-0 z-[101] w-full text-xs mx-auto bg-gradient-to-r from-red-900 to-red-700 p-2 rounded-sm border-hidden text-text-200">
        <p className="font-bold pb-1">The backend is currently unavailable.</p>

        <p className="px-1">
          If this is your initial setup or you just updated your Onyx
          deployment, this is likely because the backend is still starting up.
          Give it a minute or two, and then refresh the page. If that does not
          work, make sure the backend is setup and/or contact an administrator.
        </p>
      </div>
    );
  }
};
