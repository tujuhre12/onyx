import React from "react";
import crypto from "crypto";
import { Persona } from "@/app/admin/assistants/interfaces";
import { CustomTooltip } from "../tooltip/CustomTooltip";
import { buildImgUrl } from "@/app/chat/files/images/utils";

type IconSize = number | "xs" | "small" | "medium" | "large" | "header";

/**
 * Convert an MD5 hash of the string into an array of 128 bits (0 or 1).
 */
function md5ToBits(str: string): number[] {
  // 1) MD5 => 16 bytes => 32 hex chars
  const md5hex = crypto.createHash("md5").update(str).digest("hex");

  // 2) Convert each byte to 8 bits
  const bits: number[] = [];
  for (let i = 0; i < md5hex.length; i += 2) {
    const byteVal = parseInt(md5hex.substring(i, i + 2), 16);
    // push each bit (from MSB to LSB)
    for (let b = 7; b >= 0; b--) {
      bits.push((byteVal >> b) & 1);
    }
  }
  // Now 'bits' has exactly 128 bits
  return bits;
}

/**
 * Generate a symmetrical 7x7 identicon:
 * - We define columns [0..3), mirrored across the center => total 7 columns
 * - Each cell reads 1 bit from the bit array; 1 => fill, 0 => skip
 * - NO fallback for short strings—everything gets hashed
 */
export function generateIdenticon(str: string, dimension: number) {
  const bits = md5ToBits(str); // 128 bits
  const gridSize = 5;
  const halfCols = 4; // columns 0..3 => mirror them
  const cellSize = dimension / gridSize;

  let bitIndex = 0;
  const squares: JSX.Element[] = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < halfCols; col++) {
      const bit = bits[bitIndex % bits.length];
      bitIndex++;

      if (bit === 1) {
        // fill
        const xPos = col * cellSize;
        const yPos = row * cellSize;
        squares.push(
          <rect
            key={`cell-${row}-${col}`}
            x={xPos - 0.5}
            y={yPos - 0.5}
            width={cellSize + 1}
            height={cellSize + 1}
            fill="black"
          />
        );

        // mirror
        const mirrorCol = gridSize - 1 - col;
        if (mirrorCol !== col) {
          const mirrorX = mirrorCol * cellSize;
          squares.push(
            <rect
              key={`cell-${row}-${mirrorCol}`}
              x={mirrorX - 0.5}
              y={yPos - 0.5}
              width={cellSize + 1}
              height={cellSize + 1}
              fill="black"
            />
          );
        }
      }
    }
  }

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox={`0 0 ${dimension} ${dimension}`}
      style={{ display: "block" }}
    >
      {squares}
    </svg>
  );
}

/**
 * AssistantIcon (no short-string fallback):
 *  - If there's an uploaded image, show that.
 *  - Otherwise, a 7x7 identicon for any string ID (even if "1" or "5").
 */
export function AssistantIcon({
  assistant,
  size,
  border,
  disableToolip,
}: {
  assistant: Persona;
  size?: IconSize;
  border?: boolean;
  disableToolip?: boolean;
}) {
  // 1) Dimension logic
  const dimension =
    typeof size === "number"
      ? size
      : (() => {
          switch (size) {
            case "xs":
              return 16;
            case "small":
              return 24;
            case "medium":
              return 32;
            case "large":
              return 40;
            case "header":
              return 56;
            default:
              return 24;
          }
        })();

  // 2) Optional border
  const wrapperClass = border ? "ring ring-[1px] ring-border-strong" : "";

  // 3) Force the <div> to be exactly dimension×dimension
  const style = { width: dimension, height: dimension };

  return (
    <CustomTooltip
      disabled={disableToolip || !assistant.description}
      showTick
      line
      wrap
      content={assistant.description}
    >
      {assistant.uploaded_image_id ? (
        <img
          alt={assistant.name}
          src={buildImgUrl(assistant.uploaded_image_id)}
          loading="lazy"
          className={`object-cover object-center rounded-sm transition-opacity duration-300 ${wrapperClass}`}
          style={style}
        />
      ) : (
        <div className={wrapperClass} style={style}>
          {generateIdenticon((assistant.icon_shape || 0).toString(), dimension)}
        </div>
      )}
    </CustomTooltip>
  );
}
