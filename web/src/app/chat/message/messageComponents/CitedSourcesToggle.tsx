import React from "react";
import { FiFileText } from "react-icons/fi";
import { SourceIcon } from "@/components/SourceIcon";
import { WebResultIcon } from "@/components/WebResultIcon";
import { OnyxDocument } from "@/lib/search/interfaces";
import { ValidSources } from "@/lib/types";

interface SourcesToggleProps {
  citations: Array<{
    citation_num: number;
    document_id: string;
  }>;
  documentMap: Map<string, OnyxDocument>;
  messageId: number;
  onToggle: (messageId: number) => void;
}

export const CitedSourcesToggle = ({
  citations,
  documentMap,
  messageId,
  onToggle,
}: SourcesToggleProps) => {
  if (citations.length === 0) {
    return null;
  }

  // Get unique icons by creating a unique identifier for each source
  const getUniqueIcons = () => {
    const seenSources = new Set<string>();
    const uniqueIcons: Array<{
      id: string;
      element: React.ReactNode;
    }> = [];

    for (const citation of citations) {
      if (uniqueIcons.length >= 2) break;

      const doc = documentMap.get(citation.document_id);
      let sourceKey: string;
      let iconElement: React.ReactNode;

      if (doc) {
        if (doc.is_internet || doc.source_type === ValidSources.Web) {
          // For web sources, use the hostname as the unique key
          try {
            const hostname = new URL(doc.link).hostname;
            sourceKey = `web_${hostname}`;
          } catch {
            sourceKey = `web_${doc.link}`;
          }
          iconElement = (
            <WebResultIcon
              key={citation.document_id}
              url={doc.link}
              size={16}
            />
          );
        } else {
          sourceKey = `source_${doc.source_type}`;
          iconElement = (
            <SourceIcon
              key={citation.document_id}
              sourceType={doc.source_type}
              iconSize={16}
            />
          );
        }
      } else {
        sourceKey = `file_${citation.document_id}`;
        iconElement = <FiFileText key={citation.document_id} size={16} />;
      }

      if (!seenSources.has(sourceKey)) {
        seenSources.add(sourceKey);
        uniqueIcons.push({
          id: sourceKey,
          element: iconElement,
        });
      }
    }

    return uniqueIcons;
  };

  const uniqueIcons = getUniqueIcons();

  return (
    <div
      className="
        hover:bg-background-chat-hover 
        text-text-600 
        p-1.5 
        rounded 
        h-fit 
        cursor-pointer 
        flex 
        items-center 
        gap-1
      "
      onClick={() => onToggle(messageId)}
    >
      <div className="flex items-center">
        {uniqueIcons.map((icon, index) => (
          <div
            key={icon.id}
            className={index > 0 ? "-ml-1" : ""}
            style={{ zIndex: uniqueIcons.length - index }}
          >
            {icon.element}
          </div>
        ))}
        {citations.length > uniqueIcons.length && (
          <span className="text-xs text-text-500 ml-1">
            +{citations.length - uniqueIcons.length}
          </span>
        )}
      </div>
      <span className="text-sm text-text-700">Sources</span>
    </div>
  );
};
