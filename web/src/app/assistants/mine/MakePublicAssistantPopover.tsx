import React from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface MakePublicAssistantPopoverProps {
  isPublic: boolean;
  onShare: (shared: boolean) => void;
  onClose: () => void;
}

export function MakePublicAssistantPopover({
  isPublic,
  onShare,
  onClose,
}: MakePublicAssistantPopoverProps) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">
        {isPublic ? "Public Agent" : "Make Agent Public"}
      </h2>

      <p className="text-sm">
        This agent is currently{" "}
        <span className="font-semibold">{isPublic ? "public" : "private"}</span>
        .
        {isPublic
          ? " Anyone can currently access this agent."
          : " Only you can access this agent."}
      </p>

      <Separator />

      {isPublic ? (
        <div className="space-y-4">
          <p className="text-sm">
            To restrict access to this agent, you can make it private again.
          </p>
          <Button
            onClick={async () => {
              await onShare(false);
              onClose();
            }}
            size="sm"
            variant="destructive"
          >
            Make Agent Private
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm">
            Making this agent public will allow anyone with the link to view and
            use it. Ensure that all content and capabilities of the agent are
            safe to share.
          </p>
          <Button
            onClick={async () => {
              await onShare(true);
              onClose();
            }}
            size="sm"
          >
            Make Agent Public
          </Button>
        </div>
      )}
    </div>
  );
}
