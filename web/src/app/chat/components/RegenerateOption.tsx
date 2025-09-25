import { getDisplayNameForModel, LlmDescriptor } from "@/lib/hooks";
import { parseLlmDescriptor } from "@/lib/llm/utils";
import { useState } from "react";
import { Hoverable } from "@/components/Hoverable";
import { IconType } from "react-icons";
import { FiRefreshCw } from "react-icons/fi";
import LLMPopover from "@/app/chat/components/input/LLMPopover";

export interface RegenerateOptionProps {
  regenerate: (modelOverRide: LlmDescriptor) => Promise<void>;
  overriddenModel?: string;
  onDropdownVisibleChange: (isVisible: boolean) => void;
}

export default function RegenerateOption({
  regenerate,
  overriddenModel,
  onDropdownVisibleChange,
}: RegenerateOptionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleDropdownVisible = (isVisible: boolean) => {
    setIsOpen(isVisible);
    onDropdownVisibleChange(isVisible);
  };

  return (
    <LLMPopover
      requiresImageGeneration={false}
      currentModelName={overriddenModel}
      trigger={
        <div onClick={() => toggleDropdownVisible(!isOpen)}>
          {!overriddenModel ? (
            <Hoverable size={16} icon={FiRefreshCw as IconType} />
          ) : (
            <Hoverable
              size={16}
              icon={FiRefreshCw as IconType}
              hoverText={getDisplayNameForModel(overriddenModel)}
            />
          )}
        </div>
      }
      onSelect={(value) => {
        const { name, provider, modelName } = parseLlmDescriptor(
          value as string
        );
        regenerate({
          name: name,
          provider: provider,
          modelName: modelName,
        });
      }}
      align="start"
    />
  );
}
