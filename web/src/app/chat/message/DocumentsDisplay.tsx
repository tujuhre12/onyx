import React from "react";
import { OnyxDocument } from "@/lib/search/interfaces";

interface DocumentsDisplayProps {
  documents: OnyxDocument[];
}

const DocumentsDisplay: React.FC<DocumentsDisplayProps> = ({ documents }) => {
  return (
    <div className="h-[251px] p-4 flex-col justify-start items-start gap-4 flex">
      <div className="justify-start items-center gap-2 inline-flex">
        <div className="text-black text-base font-medium font-['KH Teka TRIAL']">
          Sources
        </div>
      </div>
      <div className="self-stretch px-8 justify-start items-center gap-6 inline-flex">
        {documents.slice(0, 3).map((doc, index) => (
          <div
            key={index}
            className="w-[200px] h-20 p-2 bg-[#f1eee8] rounded-lg justify-center items-start gap-2 flex"
          >
            <div className="grow shrink basis-0 self-stretch flex-col justify-start items-start inline-flex">
              <div className="self-stretch text-black text-xs font-medium font-['KH Teka TRIAL'] leading-[15px]">
                {doc.blurb.slice(0, 100)}...
              </div>
              <div className="self-stretch justify-start items-center gap-1 inline-flex">
                <div className="w-[17px] h-4 p-[3px] flex-col justify-center items-center gap-2.5 inline-flex">
                  <div className="h-2.5 relative" />
                </div>
                <div className="text-[#4a4a4a] text-xs font-medium font-['KH Teka TRIAL'] leading-normal">
                  {doc.semantic_identifier || "Unknown Source"}
                </div>
              </div>
            </div>
          </div>
        ))}
        {documents.length > 3 && (
          <div className="w-[200px] h-20 p-2 bg-[#f1eee8] rounded-lg justify-start items-end gap-2.5 flex">
            <div className="flex-col justify-start items-start gap-[26px] inline-flex">
              <div className="self-stretch justify-start items-center inline-flex">
                <div className="w-[17px] h-4 p-[3px] flex-col justify-center items-center gap-2.5 inline-flex">
                  <div className="h-2.5 relative overflow-hidden" />
                </div>
                <div className="w-4 h-4 px-[2.67px] py-1 justify-center items-center flex overflow-hidden">
                  <div className="w-[10.67px] h-2 relative flex-col justify-start items-start flex overflow-hidden" />
                </div>
                <div className="w-4 h-4 p-[3px] justify-center items-center gap-2.5 flex overflow-hidden" />
              </div>
              <div className="self-stretch text-[#4a4a4a] text-xs font-medium font-['KH Teka TRIAL'] leading-normal">
                Show All
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsDisplay;
