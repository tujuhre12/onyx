import React from "react";
import { Persona } from "@/app/admin/assistants/interfaces";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HashtagIcon, PinnedIcon } from "@/components/icons/icons";
import { FaHashtag } from "react-icons/fa";

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
    <div className="w-full p-2 bg-[#fefcf9] rounded shadow-[0px_0px_4px_0px_rgba(0,0,0,0.25)] flex">
      {/* Left column: Image */}
      <div className="mr-2">
        <img
          className="w-14 h-14"
          src={persona.uploaded_image_id || "https://via.placeholder.com/56x56"}
          alt={persona.name}
        />
      </div>

      {/* Right column: Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-black text-base font-normal">{persona.name}</h3>
            <span className="text-black text-xs">
              {persona.is_public ? "Public" : "Private"}
            </span>
          </div>
          {persona.is_default_persona && (
            <span className="text-[#6c6c6c] text-xs">Pinned</span>
          )}
        </div>

        {/* Description */}
        <p className="text-black text-xs mb-2">{persona.description}</p>

        {/* Tools */}
        {persona.tools.length > 0 && (
          <div className="mb-2">
            <span className="text-black text-xs mr-1">Tools</span>
            {persona.tools.map((tool, index) => (
              <AssistantBadge key={index} text={tool.name} />
            ))}
          </div>
        )}

        {/* Document Sets */}
        <div className="mb-2 flex flex-wrap">
          {persona.document_sets.slice(0, 5).map((set, index) => (
            <AssistantBadge key={index} text={set.name} />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="px-2 py-0.5 gap-x-1 rounded border border-black flex items-center">
                  <FaHashtag size={12} />
                  <span className="text-xs">Start Chat</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start a new chat with this assistant</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="px-2 py-0.5 gap-x-1 rounded border border-black flex items-center">
                  <PinnedIcon size={12} />
                  <span className="text-xs">Unpin Assistant</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Remove this assistant from your pinned list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default NewAssistantCard;
