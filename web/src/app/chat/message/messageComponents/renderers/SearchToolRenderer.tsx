import React from "react";
import { FiSearch, FiGlobe } from "react-icons/fi";
import {
  PacketType,
  ToolPacket,
  ToolStart,
  ToolEnd,
  ToolDelta,
} from "../../../services/streamingModels";
import { MessageRenderer, FullChatState } from "../interfaces";
import { SourceChip2 } from "../../../components/input/ChatInputBar";
import { ResultIcon } from "@/components/chat/sources/SourceCard";
import { truncateString } from "@/lib/utils";
import { OnyxDocument } from "@/lib/search/interfaces";

const Icon = FiSearch;

export const SearchToolRenderer: MessageRenderer<ToolPacket, {}> = ({
  packets,
}: {
  packets: ToolPacket[];
}) => {
  const searchStart = packets.find(
    (packet) => packet.obj.type === PacketType.TOOL_START
  )?.obj as ToolStart;
  const searchDeltas = packets
    .filter((packet) => packet.obj.type === PacketType.TOOL_DELTA)
    .map((packet) => packet.obj as ToolDelta);

  const searchEnd = packets.find(
    (packet) => packet.obj.type === PacketType.TOOL_END
  )?.obj as ToolEnd;

  const query = searchStart?.tool_main_description;

  // Collect unique results across deltas
  const seenDocIds = new Set<string>();
  const results = searchDeltas
    .flatMap((delta) => delta?.documents || [])
    .filter((doc) => {
      if (!doc || !doc.document_id) return false;
      if (seenDocIds.has(doc.document_id)) return false;
      seenDocIds.add(doc.document_id);
      return true;
    });

  const isSearching = searchStart && !searchEnd;
  const isComplete = searchStart && searchEnd;

  // Don't render anything if search hasn't started
  if (!searchStart) {
    return [Icon, <div></div>];
  }

  // Unified rendering for both searching and complete states
  return [
    Icon,
    <div className="flex flex-col">
      <div className="text-sm leading-normal flex">
        {isSearching
          ? "Searching through internal documents"
          : "Searched internal documents"}
      </div>
      <div className="flex flex-wrap gap-2 ml-1 mt-1">
        {query && (
          <div
            className={`text-xs text-gray-600 mb-2 ${isSearching ? "animate-pulse" : ""}`}
          >
            <SourceChip2
              icon={<FiSearch size={10} />}
              title={truncateString(query, 30)}
            />
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 ml-1">
        {results.slice(0, 3).map((result, index) => (
          <div
            key={result.document_id}
            className="animate-in fade-in slide-in-from-bottom-1 duration-300"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <SourceChip2
              icon={<ResultIcon doc={result} size={10} />}
              title={result.semantic_identifier || ""}
              onClick={() => {
                window.open(result.link, "_blank");
              }}
            />
          </div>
        ))}
      </div>
    </div>,
  ];
};
