import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const truncateString = (str: string, maxLength: number) => {
  return str.length > maxLength ? str.slice(0, maxLength - 1) + "..." : str;
};

// Add support for custom URL protocols in markdown links
export const ALLOWED_URL_PROTOCOLS = [
  "http:",
  "https:",
  "mailto:",
  "tel:",
  "slack:",
  "vscode:",
  "file:",
  "sms:",
  "spotify:",
  "zoommtg:",
];

/**
 * Custom URL transformer function for ReactMarkdown
 * Allows specific protocols to be used in markdown links
 * We use this with the urlTransform prop in ReactMarkdown
 */
export function transformLinkUri(href: string) {
  console.log("transformLinkUri", href);
  if (!href) return href;

  const url = href.trim();
  try {
    const parsedUrl = new URL(url);
    if (
      ALLOWED_URL_PROTOCOLS.some((protocol) =>
        parsedUrl.protocol.startsWith(protocol)
      )
    ) {
      console.log("transformLinkUri", url);
      return url;
    }
  } catch (e) {
    // If it's not a valid URL with protocol, return the original href
    console.log("transformLinkUri", href);
    return href;
  }
  console.log("transformLinkUri", href);
  return href;
}
