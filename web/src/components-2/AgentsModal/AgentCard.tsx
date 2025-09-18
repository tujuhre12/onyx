import React, { useState, useRef, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FiMoreHorizontal,
  FiTrash,
  FiEdit,
  FiBarChart,
  FiLock,
  FiUnlock,
} from "react-icons/fi";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { MinimalPersonaSnapshot } from "@/app/admin/assistants/interfaces";
import { useUser } from "@/components/user/UserProvider";
import { checkUserOwnsAssistant as checkUserOwnsAgent } from "@/lib/assistants/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconProps, PinnedIcon } from "@/components/icons/icons";
import { deletePersona } from "@/app/admin/assistants/lib";
import { PencilIcon } from "lucide-react";
import { usePaidEnterpriseFeaturesEnabled } from "@/components/settings/usePaidEnterpriseFeaturesEnabled";
import { truncateString } from "@/lib/utils";
import { usePopup } from "@/components/admin/connectors/Popup";
import { Button } from "@/components/ui/button";
import { useAgentsContext } from "@/components-2/context/AgentsContext";
import Text from "@/components-2/Text";
import Truncated from "@/components-2/Truncated";

interface AgentActionButtonProps {
  title: string;
  icon: React.FunctionComponent<IconProps>;
  onClick: () => void;
  tooltip: string;
}

function AgentActionButton({
  title,
  icon: Icon,
  onClick,
  tooltip,
}: AgentActionButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={
              "hover:bg-background-tint-03 p-spacing-interline gap-spacing-interline rounded-04 border flex items-center"
            }
          >
            <Icon size={12} />
            <Text secondary>{title}</Text>
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AgentCardProps {
  agent: MinimalPersonaSnapshot;
  pinned: boolean;
  closeModal: () => void;
}

export default function AssistantCard({
  agent,
  pinned,
  closeModal,
}: AgentCardProps) {
  const router = useRouter();
  const { user } = useUser();
  const { setPinnedAgents, refreshAgents } = useAgentsContext();
  const { popup, setPopup } = usePopup();
  const isPaidEnterpriseFeaturesEnabled = usePaidEnterpriseFeaturesEnabled();
  const [isDeleteConfirmation, setIsDeleteConfirmation] = useState(false);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const hiddenNameRef = useRef<HTMLSpanElement>(null);
  const [isNameTruncated, setIsNameTruncated] = useState(false);
  useLayoutEffect(() => {
    const checkTruncation = () => {
      if (nameRef.current && hiddenNameRef.current) {
        const visibleWidth = nameRef.current.offsetWidth;
        const fullTextWidth = hiddenNameRef.current.offsetWidth;
        setIsNameTruncated(fullTextWidth > visibleWidth);
      }
    };

    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [agent.name]);

  const isOwnedByUser = checkUserOwnsAgent(user, agent);
  const handleDelete = () => {
    setIsDeleteConfirmation(true);
  };
  const confirmDelete = async () => {
    const response = await deletePersona(agent.id);
    if (response.ok) {
      await refreshAgents();
      setIsDeleteConfirmation(false);
      setPopup({
        message: `${agent.name} has been successfully deleted.`,
        type: "success",
      });
    } else {
      setPopup({
        message: `Failed to delete agent - ${await response.text()}`,
        type: "error",
      });
    }
  };
  const cancelDelete = () => {
    setIsDeleteConfirmation(false);
  };
  const handleEdit = () => {
    router.push(`/assistants/edit/${agent.id}`);
  };

  return (
    <div className="w-full h-full p-padding-content bg-background-tint-02 rounded-08">
      {popup}
      <div className="w-full h-full flex flex-row gap-spacing-paragraph">
        <AssistantIcon assistant={agent} size="large" />

        <div className="flex-1 flex flex-col gap-padding-button">
          <div className="flex flex-row justify-between">
            <Truncated>
              <Text subheading text04>
                {agent.name}
              </Text>
            </Truncated>

            {isOwnedByUser && (
              <div className="flex ml-2 relative items-center gap-x-2">
                <Popover>
                  <PopoverTrigger>
                    <button
                      type="button"
                      className="hover:bg-background-neutral-02 p-1 -my-1 rounded-full"
                      aria-label="More Options"
                    >
                      <FiMoreHorizontal size={16} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className={`${
                      isDeleteConfirmation ? "w-64" : "w-32"
                    } z-[10000] p-2`}
                  >
                    {!isDeleteConfirmation ? (
                      <div className="flex flex-col text-sm space-y-1">
                        <button
                          onClick={isOwnedByUser ? handleEdit : undefined}
                          className={`w-full flex items-center text-left px-2 py-1 rounded ${
                            isOwnedByUser
                              ? "hover:bg-background-neutral-02"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                          disabled={!isOwnedByUser}
                        >
                          <FiEdit size={12} className="inline mr-2" />
                          Edit
                        </button>
                        {isPaidEnterpriseFeaturesEnabled && isOwnedByUser && (
                          <button
                            onClick={
                              isOwnedByUser
                                ? () =>
                                    router.push(`/assistants/stats/${agent.id}`)
                                : undefined
                            }
                            className={`w-full text-left items-center px-2 py-1 rounded ${
                              isOwnedByUser
                                ? "hover:bg-background-neutral-02"
                                : "opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <FiBarChart size={12} className="inline mr-2" />
                            Stats
                          </button>
                        )}
                        <button
                          onClick={isOwnedByUser ? handleDelete : undefined}
                          className={`w-full text-left items-center px-2 py-1 rounded ${
                            isOwnedByUser
                              ? "hover:bg-background-neutral-02 text-action-danger-05"
                              : "opacity-50 cursor-not-allowed text-action-danger-03"
                          }`}
                          disabled={!isOwnedByUser}
                        >
                          <FiTrash size={12} className="inline mr-2" />
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="w-full">
                        <p className="text-sm mb-3">
                          Are you sure you want to delete agent{" "}
                          <b>{agent.name}</b>?
                        </p>
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={cancelDelete}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={confirmDelete}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <Text text03 className="flex-1">
            {agent.description}
          </Text>

          <div className="flex flex-row items-center gap-spacing-interline">
            <div className="max-w-[33%]">
              <Truncated>
                <Text secondary text02>
                  By {agent.owner?.email || "Onyx"} asdf
                </Text>
              </Truncated>
            </div>
            <Text secondary text01>
              •
            </Text>
            <Text secondary text02>
              {agent.tools.length > 0
                ? `${agent.tools.length} Action${agent.tools.length > 1 ? "s" : ""}`
                : "No Actions"}
            </Text>
            <Text secondary text01>
              •
            </Text>
            <Text secondary text02>
              {agent.is_public ? "Public" : "Private"}
            </Text>
          </div>

          <div className="flex gap-2">
            <AgentActionButton
              title="Start Chat"
              icon={PencilIcon as React.FunctionComponent<IconProps>}
              onClick={() => {
                router.push(`/chat?assistantId=${agent.id}`);
                closeModal();
              }}
              tooltip="Start a new chat with this agent"
            />
            <AgentActionButton
              title={pinned ? "Unpin" : "Pin"}
              icon={PinnedIcon}
              onClick={() =>
                setPinnedAgents((prev) =>
                  pinned
                    ? prev.filter((prevAgent) => prevAgent.id !== agent.id)
                    : [...prev, agent]
                )
              }
              tooltip={`${pinned ? "Remove from" : "Add to"} your pinned list`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
