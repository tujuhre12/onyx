import React from "react";
import { SavedSearchDoc } from "@/app/search/interfaces";
import { getSourceMetadata } from "@/lib/sources";
import { ExternalLink, Calendar, User } from "lucide-react";

interface SearchResultItemProps {
  doc: SavedSearchDoc;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function SearchResultItem({
  doc,
  isSelected = false,
  onClick,
}: SearchResultItemProps) {
  const sourceMetadata = getSourceMetadata(doc.source_type);
  const SourceIcon = sourceMetadata.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return null;
    }
  };

  const formatScore = (score: number) => {
    return (score * 100).toFixed(1);
  };

  return (
    <div
      className={`
        rounded-lg p-5 cursor-pointer transition-all duration-200
        ${
          isSelected
            ? "bg-blue-50 dark:bg-blue-900/20"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }
        hover:shadow-md
      `}
      onClick={onClick}
    >
      {/* Header with source icon, title, and score */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          {/* First line: Icon and Title */}
          <div className="flex items-center gap-3 mb-1">
            <div className="flex-shrink-0">
              <SourceIcon size={20} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
              {doc.semantic_identifier}
            </h3>
          </div>

          {/* Second line: Source type, date, and open button */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{sourceMetadata.displayName}</span>
            {doc.updated_at && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  <span>{formatDate(doc.updated_at)}</span>
                </div>
              </>
            )}
            {doc.link && (
              <>
                <span>•</span>
                <a
                  href={doc.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={12} />
                  <span>Open</span>
                </a>
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 ml-2">
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
            {formatScore(doc.score)}%
          </span>
        </div>
      </div>

      {/* Content preview */}
      <div className="py-3">
        <p className="text-sm line-clamp-3 text-muted-foreground">
          {doc.blurb}
        </p>
      </div>

      {/* Metadata footer */}
      <div className="flex items-center justify-between text-xs text-gray-500 ">
        <div className="flex items-center gap-4">
          {/* Owners */}
          {doc.primary_owners && doc.primary_owners.length > 0 && (
            <div className="flex items-center gap-1">
              <User size={12} />
              <span>{doc.primary_owners[0]}</span>
              {doc.primary_owners.length > 1 && (
                <span>+{doc.primary_owners.length - 1}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
