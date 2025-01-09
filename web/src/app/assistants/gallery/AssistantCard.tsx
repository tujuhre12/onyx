import React from "react";
import { Persona } from "@/app/admin/assistants/interfaces";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OnyxIcon, PinnedIcon } from "@/components/icons/icons";
import { FaHashtag } from "react-icons/fa";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";

export const AssistantBadge = ({ text }: { text: string }) => {
  return (
    <div className="h-4 px-1.5 py-1 bg-[#e6e3dd]/50 rounded-lg justify-center items-center gap-2.5 inline-flex">
      <div className="text-[#4a4a4a] text-[10px] font-normal leading-[8px]">
        {text}
      </div>
    </div>
  );
};

const NewAssistantCard: React.FC<{ persona: Persona }> = ({ persona }) => {
  return (
    <div className="w-full p-2 overflow-visible  bg-[#fefcf9] rounded shadow-[0px_0px_4px_0px_rgba(0,0,0,0.25)] flex">
      {/* Left column: Image */}
      <div className="ml-2 mr-4  mt-1 w-8 h-8">
        <OnyxIcon size={40} />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-end  gap-x-2 leading-none">
            <h3 className="text-black leading-none text-base font-normal">
              {persona.name}
            </h3>
            <span className="text-black text-xs leading-none">
              <AssistantBadge text={persona.is_public ? "Public" : "Private"} />
            </span>
          </div>
          {persona.is_default_persona && (
            <span className="text-[#6c6c6c] text-xs">Pinned</span>
          )}
        </div>

        <p className="text-black text-xs mb-1">{persona.description}</p>

        {persona.tools.length > 0 && (
          <div className="mb-1">
            <span className="text-black text-xs mr-1">Tools</span>
            {persona.tools.map((tool, index) => (
              <AssistantBadge key={index} text={tool.name} />
            ))}
          </div>
        )}

        {/* Document Sets */}
        <div className="mb-1 flex flex-wrap">
          {persona.document_sets.slice(0, 5).map((set, index) => (
            <AssistantBadge key={index} text={set.name} />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="hover:bg-neutral-100 px-2 py-0.5 gap-x-1 rounded border border-black flex items-center">
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
                <button className="hover:bg-neutral-100 px-2 py-0.5 gap-x-1 rounded border border-black flex items-center">
                  <PinnedIcon size={12} />
                  <span className="text-xs">Unpin Assistant</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                Remove this assistant from your pinned list
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default NewAssistantCard;
