import { useState, useEffect } from "react";

interface UseAgentSearchToggleProps {
  chatSessionId: string | null;
  assistantId: number | undefined;
}

/**
 * Custom hook for managing the agent search (deep research) toggle state.
 * Automatically resets the toggle to false when:
 * - The chat session changes
 * - The assistant changes
 * - The page is reloaded (since state initializes to false)
 *
 * @param chatSessionId - The current chat session ID
 * @param assistantId - The current assistant ID
 * @returns An object containing the toggle state and toggle function
 */
export function useAgentSearchToggle({
  chatSessionId,
  assistantId,
}: UseAgentSearchToggleProps) {
  const [proSearchEnabled, setProSearchEnabled] = useState(false);

  // Reset when switching chat sessions
  useEffect(() => {
    setProSearchEnabled(false);
  }, [chatSessionId]);

  // Reset when switching assistants
  useEffect(() => {
    setProSearchEnabled(false);
  }, [assistantId]);

  const toggleProSearch = () => {
    setProSearchEnabled(!proSearchEnabled);
  };

  return {
    proSearchEnabled,
    toggleProSearch,
  };
}
