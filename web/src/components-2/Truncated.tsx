import React, { useState, useRef, useLayoutEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Text, { TextProps } from "./Text";

interface TruncatedProps extends TextProps {
  tooltipSide?: "top" | "right" | "bottom" | "left";
  tooltipSideOffset?: number;
  disableTooltip?: boolean;
}

/**
 * Renders passed in text on a single line. If text is truncated,
 * shows a tooltip on hover with the full text.
 */
export default function Truncated({
  tooltipSide = "right",
  tooltipSideOffset = 5,
  disableTooltip,
  children,
  ...rest
}: TruncatedProps) {
  const [isTruncated, setIsTruncated] = useState(false);
  const visibleRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    function checkTruncation() {
      if (visibleRef.current && hiddenRef.current) {
        const visibleWidth = visibleRef.current.offsetWidth;
        const fullTextWidth = hiddenRef.current.offsetWidth;
        setIsTruncated(fullTextWidth > visibleWidth);
      }
    }

    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [children]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div ref={visibleRef} className="flex-grow overflow-hidden text-left">
            <Text
              className={`line-clamp-1 break-all text-left ${rest.className}`}
              {...rest}
            >
              {children}
            </Text>
          </div>
        </TooltipTrigger>

        {/* Hide offscreen to measure full text width */}
        <div
          ref={hiddenRef}
          className="absolute left-[-9999px] whitespace-nowrap pointer-events-none"
          aria-hidden="true"
        >
          {children}
        </div>

        {!disableTooltip && isTruncated && (
          <TooltipContent side={tooltipSide} sideOffset={tooltipSideOffset}>
            <Text>{children}</Text>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
