import { Citation } from "@/components/search/results/Citation";
import { LoadedOnyxDocument, OnyxDocument } from "@/lib/search/interfaces";
import React, { memo } from "react";
import isEqual from "lodash/isEqual";
import { SourceIcon } from "@/components/SourceIcon";
import { SearchResultIcon } from "@/components/SearchResultIcon";
import { WebResultIcon } from "@/components/WebResultIcon";

const FALLBACK_ICON = "web.svg";

// Updated error handler
const handleError = (
  e: React.SyntheticEvent<HTMLImageElement>,
  associatedDoc: OnyxDocument
) => {
  // Prevent future error events
  e.currentTarget.onerror = null;

  // Repoint image source to fallback
  e.currentTarget.src = FALLBACK_ICON;

  // If you prefer, log fewer times or log once.
  // For demonstration, we'll print a single warning:
  console.warn(
    `Failed to load favicon for document_id=${associatedDoc?.document_id}. Replacing with fallback icon.`
  );
};

export const MemoizedAnchor = memo(
  ({
    docs,
    iconMap,
    updatePresentingDocument,
    children,
  }: {
    docs?: OnyxDocument[] | null;
    iconMap?: Record<string, string>;
    updatePresentingDocument: (doc: OnyxDocument) => void;
    children: React.ReactNode;
  }) => {
    const value = children?.toString();
    if (value?.startsWith("[") && value?.endsWith("]")) {
      const match = value.match(/\[(\d+)\]/);
      if (match) {
        const index = parseInt(match[1], 10) - 1;
        const associatedDoc = docs?.[index];
        if (!associatedDoc) {
          return <>{children}</>;
        }

        const effectiveIconURL =
          iconMap?.[associatedDoc.document_id] || "globe.svg";

        let icon: React.ReactNode = null;
        if (associatedDoc.source_type === "web") {
          icon = <WebResultIcon url={associatedDoc.link} />;
          // (
          //   <img
          //     className="!m-0 !p-0 rounded-full"
          //     height={18}
          //     onError={(e) => {
          //       handleError(e, associatedDoc);
          //     }}
          //     width={18}
          //     src={`https://www.google.com/s2/favicons?domain=${
          //       new URL(associatedDoc.link).hostname
          //     }`}
          //     alt="Favicon"
          //   />
          // );
        } else {
          icon = (
            <SourceIcon sourceType={associatedDoc.source_type} iconSize={18} />
          );
        }

        return (
          <MemoizedLink
            updatePresentingDocument={updatePresentingDocument}
            document={{
              ...associatedDoc,
              icon,
              url: associatedDoc.link,
            }}
          >
            {children}
          </MemoizedLink>
        );
      }
    }
    return (
      <MemoizedLink updatePresentingDocument={updatePresentingDocument}>
        {children}
      </MemoizedLink>
    );
  }
);

export const MemoizedLink = memo((props: any) => {
  const { node, document, updatePresentingDocument, ...rest } = props;
  const value = rest.children;

  if (value?.toString().startsWith("*")) {
    return (
      <div className="flex-none bg-background-800 inline-block rounded-full h-3 w-3 ml-2" />
    );
  } else if (value?.toString().startsWith("[")) {
    return (
      <Citation
        url={document?.url}
        icon={document?.icon as React.ReactNode}
        document={document as LoadedOnyxDocument}
        updatePresentingDocument={updatePresentingDocument}
      >
        {rest.children}
      </Citation>
    );
  }

  return (
    <a
      onMouseDown={() => rest.href && window.open(rest.href, "_blank")}
      className="cursor-pointer text-link hover:text-link-hover"
    >
      {rest.children}
    </a>
  );
});

export const MemoizedParagraph = memo(
  function MemoizedParagraph({ children }: any) {
    return <p className="text-default">{children}</p>;
  },
  (prevProps, nextProps) => {
    const areEqual = isEqual(prevProps.children, nextProps.children);
    return areEqual;
  }
);

MemoizedAnchor.displayName = "MemoizedAnchor";
MemoizedLink.displayName = "MemoizedLink";
MemoizedParagraph.displayName = "MemoizedParagraph";
