import { useCallback, useEffect, useState } from "react";
import { OnyxDocument } from "@/lib/search/interfaces";

const FALLBACK_ICON = "globe.svg";

/**
 * Preloads doc favicons so they’re available by the time
 * the UI references them. Returns a map: docID -> loadedIconURL
 */
export function useFaviconPreloader(docs: OnyxDocument[] = []) {
  const [iconMap, setIconMap] = useState<Record<string, string>>({});
  const handleError = useCallback(
    (
      e: React.SyntheticEvent<HTMLImageElement>,
      associatedDoc: OnyxDocument
    ) => {
      setIconMap((prev) => ({
        ...prev,
        [associatedDoc.document_id]: FALLBACK_ICON,
      }));
    },
    []
  );

  useEffect(() => {
    docs.forEach((doc) => {
      if (!doc.document_id || iconMap[doc.document_id]) return;

      // Compute the favicon URL for each doc
      const iconURL = doc.link ? new URL(doc.link).origin + "/favicon.ico" : "";

      // If there is no link, we can store fallback immediately
      if (!iconURL) {
        setIconMap((prev) => ({
          ...prev,
          [doc.document_id]: FALLBACK_ICON,
        }));
        return;
      }

      // Preload the favicon
      const img = new Image();
      img.onload = () => {
        // Successfully loaded, store it in iconMap
        setIconMap((prev) => ({
          ...prev,
          [doc.document_id]: iconURL,
        }));
      };
      img.onerror = () => {
        // Fallback if loading fails
        setIconMap((prev) => ({
          ...prev,
          [doc.document_id]: FALLBACK_ICON,
        }));
      };
      img.src = iconURL;
    });
  }, [docs, iconMap]);

  return { iconMap, handleError };
}
