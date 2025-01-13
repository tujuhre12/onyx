import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FiMoreHorizontal,
  FiShare2,
  FiEye,
  FiEyeOff,
  FiTrash,
  FiEdit,
  FiHash,
} from "react-icons/fi";
import { FaHashtag } from "react-icons/fa";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { AssistantVisibilityPopover } from "./AssistantVisibilityPopover";
import { DeleteAssistantPopover } from "./DeleteAssistantPopover";
import { Persona } from "@/app/admin/assistants/interfaces";
import { useUser } from "@/components/user/UserProvider";
import { useAssistants } from "@/components/context/AssistantsContext";
import { checkUserOwnsAssistant } from "@/lib/assistants/utils";
import { toggleAssistantPinnedStatus } from "@/lib/assistants/updateAssistantPreferences";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { PinnedIcon } from "@/components/icons/icons";
import {
  deletePersona,
  togglePersonaPublicStatus,
} from "@/app/admin/assistants/lib";

export const AssistantBadge = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  return (
    <div
      className={`h-4 px-1.5 py-1 bg-[#e6e3dd]/50 rounded-lg justify-center items-center gap-2.5 inline-flex ${className}`}
    >
      <div className="text-[#4a4a4a] text-[10px] font-normal leading-[8px]">
        {text}
      </div>
    </div>
  );
};

const AssistantCard: React.FC<{
  persona: Persona;
  pinned: boolean;
  closeModal: () => void;
}> = ({ persona, pinned, closeModal }) => {
  const { user, refreshUser } = useUser();
  const router = useRouter();
  const { refreshAssistants } = useAssistants();

  const isOwnedByUser = checkUserOwnsAssistant(user, persona);

  const [activePopover, setActivePopover] = useState<string | null | undefined>(
    undefined
  );

  const handleShare = () => setActivePopover("visibility");
  const handleDelete = () => setActivePopover("delete");
  const handleEdit = () => {
    router.push(`/assistants/edit/${persona.id}`);
    setActivePopover(null);
  };

  const closePopover = () => setActivePopover(undefined);

  return (
    <div className="w-full p-2 overflow-visible bg-[#fefcf9] rounded shadow-[0px_0px_4px_0px_rgba(0,0,0,0.25)] flex">
      <div className="ml-2 mr-4 mt-1 w-8 h-8">
        <AssistantIcon assistant={persona} size="large" />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-end gap-x-2 leading-none">
            <h3 className="text-black leading-none text-base lg-normal">
              {persona.name}
            </h3>
          </div>
          <div className="flex items-center gap-x-2">
            <AssistantBadge text={persona.is_public ? "Public" : "Private"} />
            {isOwnedByUser && (
              <Popover
                open={activePopover !== undefined}
                onOpenChange={(open) =>
                  open ? setActivePopover(null) : setActivePopover(undefined)
                }
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="hover:bg-neutral-100 p-1 -my-1 rounded-full"
                  >
                    <FiMoreHorizontal size={16} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className={`z-[10000] ${
                    activePopover === null ? "w-52" : "w-80"
                  } p-4`}
                >
                  {activePopover === null && (
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={handleShare}
                        className="w-full text-left flex items-center px-2 py-1 hover:bg-neutral-100 rounded"
                      >
                        <FiShare2 size={14} className="inline mr-2" />
                        Visibility
                      </button>

                      <button
                        onClick={handleEdit}
                        className="w-full flex items-center text-left px-2 py-1 hover:bg-neutral-100 rounded"
                      >
                        <FiEdit size={14} className="inline mr-2" />
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        className="w-full text-left items-center px-2 py-1 hover:bg-neutral-100 rounded text-red-600"
                      >
                        <FiTrash size={14} className="inline mr-2" />
                        Delete
                      </button>
                    </div>
                  )}
                  {activePopover === "visibility" && (
                    <AssistantVisibilityPopover
                      assistant={persona}
                      user={user}
                      allUsers={[]}
                      onClose={closePopover}
                      onTogglePublic={async (isPublic: boolean) => {
                        await togglePersonaPublicStatus(persona.id, isPublic);
                        await refreshAssistants();
                      }}
                    />
                  )}
                  {activePopover === "delete" && (
                    <DeleteAssistantPopover
                      entityName={persona.name}
                      onClose={closePopover}
                      onSubmit={async () => {
                        const success = await deletePersona(persona.id);
                        if (success) {
                          await refreshAssistants();
                        }
                        closePopover();
                      }}
                    />
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* {pinned && <span className="text-[#6c6c6c] h-0 text-sm">Pinned</span>} */}
        </div>

        <p className="text-black text-sm mb-1 line-clamp-2 h-[2.7em]">
          {persona.description || "\u00A0"}
        </p>

        <div className="mb-1">
          {persona.tools.length > 0 ? (
            <>
              <span className="text-black text-sm mr-1">Tools</span>
              {persona.tools.map((tool, index) => (
                <AssistantBadge key={index} text={tool.name} />
              ))}
            </>
          ) : (
            <AssistantBadge text="No Tools" className="invisible" />
          )}
        </div>

        <div className="mb-1 flex flex-wrap">
          {persona.document_sets.slice(0, 5).map((set, index) => (
            <AssistantBadge key={index} text={set.name} />
          ))}
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      router.push(`/chat?assistantId=${persona.id}`);
                      closeModal();
                    }}
                    className="hover:bg-neutral-100 px-2 py-1 gap-x-1 rounded border border-black flex items-center"
                  >
                    <FaHashtag size={12} className="flex-none" />
                    <span className="text-xs">Start Chat</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  Start a new chat with this assistant
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={async () => {
                      await toggleAssistantPinnedStatus(persona.id, !pinned);
                      await refreshUser();
                    }}
                    className="hover:bg-neutral-100 px-2 py-1 gap-x-1 rounded border border-black flex items-center"
                  >
                    <PinnedIcon size={12} />
                    <span className="text-xs">{pinned ? "Unpin" : "Pin"}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {pinned ? "Remove from" : "Add to"} your pinned list
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssistantCard;
