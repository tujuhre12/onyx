import { useEffect, RefObject } from "react";

export interface UseClickOutsideOptions {
  /**
   * The event type to listen for. Defaults to 'mousedown'.
   */
  eventType?: keyof DocumentEventMap;

  /**
   * Whether the hook is enabled. Defaults to true.
   */
  enabled?: boolean;
}

/**
 * A generic hook that detects clicks outside of a referenced element.
 *
 * @param ref - A ref to the element to monitor for outside clicks
 * @param callback - Function to call when a click outside is detected
 * @param options - Configuration options for the hook
 *
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   useClickOutside(ref, () => setIsOpen(false), {
 *     enabled: isOpen,
 *     eventType: 'mousedown'
 *   });
 *
 *   return (
 *     <div ref={ref}>
 *       {isOpen && <div>Content</div>}
 *     </div>
 *   );
 * };
 * ```
 *
 * @example
 * ```tsx
 * const Dropdown = () => {
 *   const dropdownRef = useRef<HTMLDivElement>(null);
 *   const [isOpen, setIsOpen] = useState(false);
 *
 *   useClickOutside(dropdownRef, () => setIsOpen(false), {
 *     enabled: isOpen
 *   });
 *
 *   return (
 *     <div>
 *       {isOpen && <div ref={dropdownRef}>Dropdown content</div>}
 *     </div>
 *   );
 * };
 * ```
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  callback: () => void,
  options: UseClickOutsideOptions = {}
): void {
  const { eventType = "mousedown", enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleClickOutside = (event: Event) => {
      const target = event.target as Node;

      // Check if click is outside the main ref
      if (ref.current && !ref.current.contains(target)) {
        callback();
      }
    };

    document.addEventListener(eventType, handleClickOutside);

    return () => {
      document.removeEventListener(eventType, handleClickOutside);
    };
  }, [ref, callback, eventType, enabled]);
}

/**
 * A specialized version of useClickOutside for common modal/dropdown patterns.
 *
 * @param ref - A ref to the element to monitor for outside clicks
 * @param callback - Function to call when a click outside is detected
 * @param isOpen - Whether the element is currently open/visible
 */
export function useClickOutsideWhenOpen<T extends HTMLElement>(
  ref: RefObject<T>,
  callback: () => void,
  isOpen: boolean
): void {
  useClickOutside(ref, callback, { enabled: isOpen });
}
