import React, { useEffect, useMemo } from "react";
import {
  FiCpu,
  FiFile,
  FiDatabase,
  FiExternalLink,
  FiDownload,
} from "react-icons/fi";
import {
  PacketType,
  CustomToolPacket,
  CustomToolStart,
  CustomToolDelta,
  SectionEnd,
} from "../../../services/streamingModels";
import { MessageRenderer, RenderType } from "../interfaces";
import { buildImgUrl } from "../../../components/files/images/utils";

function constructCustomToolState(packets: CustomToolPacket[]) {
  const toolStart = packets.find(
    (p) => p.obj.type === PacketType.CUSTOM_TOOL_START
  )?.obj as CustomToolStart | null;
  const toolDeltas = packets
    .filter((p) => p.obj.type === PacketType.CUSTOM_TOOL_DELTA)
    .map((p) => p.obj as CustomToolDelta);
  const toolEnd = packets.find((p) => p.obj.type === PacketType.SECTION_END)
    ?.obj as SectionEnd | null;

  const toolName = toolStart?.tool_name || toolDeltas[0]?.tool_name || "Tool";
  const latestDelta = toolDeltas[toolDeltas.length - 1] || null;
  const responseType = latestDelta?.response_type || null;
  const data = latestDelta?.data;
  const fileIds = latestDelta?.file_ids || null;

  const isRunning = Boolean(toolStart && !toolEnd);
  const isComplete = Boolean(toolStart && toolEnd);

  return {
    toolName,
    responseType,
    data,
    fileIds,
    isRunning,
    isComplete,
  };
}

export const CustomToolRenderer: MessageRenderer<CustomToolPacket, {}> = ({
  packets,
  onComplete,
  renderType,
}) => {
  const { toolName, responseType, data, fileIds, isRunning, isComplete } =
    constructCustomToolState(packets);

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete, onComplete]);

  const status = useMemo(() => {
    if (isComplete) {
      if (responseType === "image") return `${toolName} returned images`;
      if (responseType === "csv") return `${toolName} returned a file`;
      return `${toolName} completed`;
    }
    if (isRunning) return `${toolName} running...`;
    return null;
  }, [toolName, responseType, isComplete, isRunning]);

  const icon = useMemo(() => {
    if (responseType === "image" || responseType === "csv") return FiFile;
    if (responseType === "json" || responseType === "text") return FiDatabase;
    return FiCpu;
  }, [responseType]);

  if (renderType === RenderType.HIGHLIGHT) {
    return {
      icon,
      status: status,
      content: (
        <div className="text-sm text-muted-foreground">
          {isRunning && `${toolName} running...`}
          {isComplete && `${toolName} completed`}
        </div>
      ),
    };
  }

  return {
    icon,
    status,
    content: (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {status}
          </span>
        </div>

        {/* File responses */}
        {fileIds && fileIds.length > 0 && (
          <div className="ml-6 text-sm text-muted-foreground flex flex-col gap-2">
            {fileIds.map((fid, idx) => (
              <div key={fid} className="flex items-center gap-2">
                <span>File {idx + 1}</span>
                <a
                  href={buildImgUrl(fid)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <FiExternalLink className="w-3 h-3" /> Open
                </a>
                <a
                  href={buildImgUrl(fid)}
                  download
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <FiDownload className="w-3 h-3" /> Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* JSON/Text responses */}
        {data !== undefined && data !== null && (
          <pre className="ml-6 text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">
            {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    ),
  };
};

export default CustomToolRenderer;
