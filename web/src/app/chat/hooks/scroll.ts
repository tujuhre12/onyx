import { useState, useEffect, useRef, RefObject } from "react";
import { Message } from "../interfaces";

/**
 * A basic interface for hooking into ChatPage's DOM.
 */
export interface UseChatScrollingRefs {
  /** The main scrollable container for messages. */
  scrollableDivRef: RefObject<HTMLDivElement>;
  /** Reference to the very end of the chat. We scroll this into view. */
  endDivRef: RefObject<HTMLDivElement>;
  /** The input bar container ref, so we can measure heights to adjust padding. */
  inputRef: RefObject<HTMLDivElement>;
  /** A div at the bottom that we can dynamically resize to offset the text area height. */
  endPaddingRef: RefObject<HTMLDivElement>;
  /** Optional last-message ref if you want it. */
  lastMessageRef: RefObject<HTMLDivElement>;
}

export interface VisibleRange {
  start: number;
  end: number;
  mostVisibleMessageId: number | null;
}

/**
 * The parameters you might need for your scrolling logic.
 */
export interface UseChatScrollingParams {
  messageHistoryLength: number; // how many total messages
  autoScrollEnabled: boolean; // whether user has 'auto-scroll' turned on
  buffer?: number; // how far from the bottom triggers the floating button
  onAboveHorizonChange?: (above: boolean) => void; // callback if we want to track "above horizon"
  messageHistory: Message[];
  updateVisibleRangeBasedOnScroll: (mostVisibleIndex: number) => void;
}

/**
 * The return values from the hook:
 */
export interface UseChatScrollingReturn extends UseChatScrollingRefs {
  /**
   * Whether the user is far enough “above” the bottom that we’d want to show a
   * “Scroll to bottom” button.
   */
  aboveHorizon: boolean;
  /**
   * Call this to smooth-scroll to the bottom of the chat. You can pass `fast=true`
   * if you want to jump instantly (no smooth animation).
   */
  scrollToBottom: (fast?: boolean) => void;
  /**
   * A function you can call after the input bar height changes — it handles
   * adjusting the bottom padding or auto-scrolling if needed.
   */
  handleInputResize: () => void;
  clientHandleScroll: () => void;
}

/**
 * Extract the scroll management into a single hook.
 */
export function useChatScrolling({
  messageHistoryLength,
  autoScrollEnabled,
  messageHistory,
  updateVisibleRangeBasedOnScroll,
  buffer = 500,
  onAboveHorizonChange,
}: UseChatScrollingParams): UseChatScrollingReturn {
  // Refs to important elements.
  const scrollableDivRef = useRef<HTMLDivElement>(null);
  const endDivRef = useRef<HTMLDivElement>(null);
  const endPaddingRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);

  // Tracks how far from the bottom we are. If "aboveHorizon" is true, we might show a "scroll to bottom" button.
  const [aboveHorizon, setAboveHorizon] = useState(false);

  // Keep track if we already performed that initial auto-scroll (so we don’t keep forcing it).
  const [hasPerformedInitialScroll, setHasPerformedInitialScroll] =
    useState(false);

  // We also keep a small ref to help avoid double-jumping if the user is actively scrolling.
  const waitForScrollRef = useRef(false);

  // For measuring how the input bar's height changes over time.
  const previousHeightRef = useRef<number>(0);

  function clientHandleScroll() {
    if (!scrollableDivRef.current) return;
    const scroller = scrollableDivRef.current;
    const viewportHeight = scroller.clientHeight;
    let mostVisibleIndex = -1;

    // E.g., loop over your messages to see which one is in view
    for (let i = 0; i < messageHistoryLength; i++) {
      const msg = messageHistory[i];
      const el = document.getElementById(`message-${msg.messageId}`);
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      // etc. track “largest portion in view” or “lowest fully visible message”
      if (rect.bottom <= viewportHeight && rect.bottom > 0) {
        mostVisibleIndex = i;
      }
    }

    // Then call:
    if (mostVisibleIndex >= 0) {
      updateVisibleRangeBasedOnScroll(mostVisibleIndex);
    }
  }
  /**
   * Scroll event handler: updates `aboveHorizon` based on how far we are from the bottom.
   */
  const handleScroll = () => {
    if (!scrollableDivRef.current || !endDivRef.current) return;
    const bounding = endDivRef.current.getBoundingClientRect();
    const containerBounds = scrollableDivRef.current.getBoundingClientRect();

    // If the bottom is well below the container bottom, we’re definitely “above”.
    const distance = bounding.top - containerBounds.top;
    const isAbove = distance > buffer;
    setAboveHorizon(isAbove);

    // If a parent component wants to know about it:
    if (onAboveHorizonChange) {
      onAboveHorizonChange(isAbove);
    }
  };

  /**
   * Smoothly (or instantly, if `fast=true`) scroll the user to the bottom of the chat.
   */
  const scrollToBottom = (fast?: boolean) => {
    waitForScrollRef.current = true;
    setTimeout(() => {
      if (!endDivRef.current || !scrollableDivRef.current) return;

      endDivRef.current.scrollIntoView({
        behavior: fast ? "auto" : "smooth",
      });

      setHasPerformedInitialScroll(true);

      // Release the "lock" after a short delay so the user can manually scroll again.
      setTimeout(() => {
        waitForScrollRef.current = false;
      }, 1500);
    }, 50);
  };

  /**
   * Called whenever the input bar’s height changes.
   * We recalc padding at the bottom so messages never hide behind the bar.
   */
  const handleInputResize = () => {
    requestAnimationFrame(() => {
      if (!inputRef.current || !endPaddingRef.current) return;

      const newHeight = inputRef.current.getBoundingClientRect().height;
      const oldHeight = previousHeightRef.current;
      const heightDiff = newHeight - oldHeight;

      // Update bottom padding (somewhat optional).
      endPaddingRef.current.style.height = Math.max(newHeight - 50, 0) + "px";
      previousHeightRef.current = newHeight;

      // If auto-scroll is enabled and we have a net increase in height, adjust the scroll so the user sees everything.
      if (autoScrollEnabled && heightDiff > 0 && !waitForScrollRef.current) {
        scrollableDivRef.current?.scrollBy({
          left: 0,
          top: heightDiff,
          behavior: "smooth",
        });
      }
    });
  };

  /**
   * Attach a scroll listener on mount, remove on unmount.
   */
  useEffect(() => {
    const div = scrollableDivRef.current;
    if (!div) return;
    div.addEventListener("scroll", handleScroll);
    return () => {
      div.removeEventListener("scroll", handleScroll);
    };
  }, []);

  /**
   * Any time our message list changes (especially if we have new messages),
   * we can optionally auto-scroll if the user is near the bottom.
   */
  useEffect(() => {
    // If we haven't done the initial scroll on page load or new session, do it once:
    if (
      !hasPerformedInitialScroll &&
      autoScrollEnabled &&
      messageHistoryLength > 0
    ) {
      scrollToBottom(true);
    } else {
      // If the user is already near the bottom, keep them pinned at the bottom.
      // But if they've scrolled far away, don't forcibly yank them down.
      // If you want that behavior, you can uncomment:
      //
      // if (!aboveHorizon && autoScrollEnabled) {
      //   scrollToBottom(true);
      // }
    }
  }, [messageHistoryLength]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    scrollableDivRef,
    endDivRef,
    endPaddingRef,
    inputRef,
    lastMessageRef,
    aboveHorizon,
    scrollToBottom,
    handleInputResize,
    clientHandleScroll,
  };
}
interface UseVirtualMessagesParams {
  messageHistory: any[]; // or your real type
  bufferCount: number;
}

export function useVirtualMessages({
  messageHistory,
  bufferCount,
}: UseVirtualMessagesParams) {
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    start: 0,
    end: Math.min(bufferCount, messageHistory.length),
    mostVisibleMessageId: null,
  });

  const scrollInitialized = useRef(false);

  // Called to “expand” the visible slice if user scrolls near the top/bottom, etc.
  const updateVisibleRangeBasedOnScroll = (mostVisibleIndex: number) => {
    if (!scrollInitialized.current) return;

    // Basic example: shift the window so that the mostVisibleIndex is near the middle
    const start = Math.max(0, mostVisibleIndex - bufferCount);
    const end = Math.min(
      messageHistory.length,
      mostVisibleIndex + bufferCount + 1
    );

    setVisibleRange({
      start,
      end,
      mostVisibleMessageId: messageHistory[mostVisibleIndex]?.messageId ?? null,
    });
  };

  // Initialize once
  useEffect(() => {
    if (!scrollInitialized.current && messageHistory.length > 0) {
      const newEnd = Math.min(messageHistory.length, bufferCount);
      setVisibleRange({
        start: 0,
        end: newEnd,
        mostVisibleMessageId: messageHistory[newEnd - 1]?.messageId ?? null,
      });
      scrollInitialized.current = true;
    }
  }, [bufferCount, messageHistory]);

  // Or re-init if message list changes significantly

  return {
    visibleRange,
    updateVisibleRangeBasedOnScroll,
    setVisibleRange, // if you want direct control
  };
}
