"use client";

import { Modal } from "@/components/Modal";
import { CheckmarkIcon, CopyIcon } from "@/components/icons/icons";
import { useState } from "react";


export function CustomModal({
  isVisible,
  onClose,
  title,
  content,
  showCopyButton = false,
}: {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  content: string;
  showCopyButton?: boolean;
}) {
  const [copyClicked, setCopyClicked] = useState(false);

  if (!isVisible) return null;

  return (
    <Modal
      width="w-4/6"
      className="h-5/6 overflow-y-hidden flex flex-col"
      title={title}
      onOutsideClick={onClose}
    >
      <div className="overflow-y-auto mb-6">
        {showCopyButton && (
          <div className="mb-6">
            {!copyClicked ? (
              <div
                onClick={() => {
                  navigator.clipboard.writeText(content);
                  setCopyClicked(true);
                  setTimeout(() => setCopyClicked(false), 2000);
                }}
                className="flex w-fit cursor-pointer hover:bg-accent-background p-2 border-border border rounded"
              >
                Copy full content
                <CopyIcon className="ml-2 my-auto" />
              </div>
            ) : (
              <div className="flex w-fit hover:bg-accent-background p-2 border-border border rounded cursor-default">
                Copied to clipboard
                <CheckmarkIcon
                  className="my-auto ml-2 flex flex-shrink-0 text-success"
                  size={16}
                />
              </div>
            )}
          </div>
        )}
        <div className="whitespace-pre-wrap">{content}</div>
      </div>
    </Modal>
  );
}
