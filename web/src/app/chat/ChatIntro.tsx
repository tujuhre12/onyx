import { Persona } from "../admin/assistants/interfaces";
import { OnyxIcon } from "@/components/icons/icons";

export function ChatIntro({ selectedPersona }: { selectedPersona: Persona }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative flex flex-col gap-y-4 w-fit mx-auto justify-center">
        <div className="absolute z-10 -left-12 top-1/2 -translate-y-1/2">
          <OnyxIcon size={40} className="flex-none" />
        </div>

        <div className="text-5xl text-black font-normal text-center">
          {selectedPersona.name}
        </div>
      </div>
      <div className="self-stretch text-center text-black text-lg font-normal font-['KH Teka TRIAL'] leading-normal">
        {selectedPersona.description}
      </div>
    </div>
  );
}
