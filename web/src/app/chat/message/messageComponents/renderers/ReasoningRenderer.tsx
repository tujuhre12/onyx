import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PacketType,
  ReasoningDelta,
  ReasoningPacket,
  ReasoningStart,
} from "../../../services/streamingModels";
import { MessageRenderer, RenderType } from "../interfaces";
import ThinkingBox from "../../thinkingBox/ThinkingBox";

function constructCurrentReasoningState(packets: ReasoningPacket[]) {
  const hasStart = packets.some(
    (p) => p.obj.type === PacketType.REASONING_START
  );
  const hasEnd = packets.some((p) => p.obj.type === PacketType.REASONING_END);
  const deltas = packets
    .filter((p) => p.obj.type === PacketType.REASONING_DELTA)
    .map((p) => p.obj as ReasoningDelta);

  const content = deltas.map((d) => d.reasoning).join("");

  return {
    hasStart,
    hasEnd,
    content,
  };
}

export const ReasoningRenderer: MessageRenderer<ReasoningPacket, {}> = ({
  packets,
  onComplete,
  renderType,
  animate,
}) => {
  const { hasStart, hasEnd, content } = useMemo(
    () => constructCurrentReasoningState(packets),
    [packets]
  );

  const completionHandledRef = useRef(false);
  useEffect(() => {
    if (hasEnd && !completionHandledRef.current) {
      completionHandledRef.current = true;
      onComplete();
    }
  }, [hasEnd, onComplete]);

  if (!hasStart && !hasEnd && content.length === 0) {
    return { icon: null, status: null, content: <></> };
  }

  return {
    icon: null,
    status: hasEnd ? "Thoughts complete" : "Thinking",
    content: (
      <ThinkingBox
        content={content}
        isComplete={hasEnd}
        isStreaming={!hasEnd}
      />
    ),
  };
};

export default ReasoningRenderer;
