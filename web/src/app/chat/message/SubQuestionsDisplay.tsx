import React from "react";
import { SubQuestionDetail } from "../interfaces";

interface SubQuestionsDisplayProps {
  subQuestions: SubQuestionDetail[];
}

const SubQuestionsDisplay: React.FC<SubQuestionsDisplayProps> = ({
  subQuestions,
}) => {
  return (
    <div className="h-[962px] py-4 rounded border border-[#f1eee8] flex-col justify-start items-start gap-2 inline-flex">
      {subQuestions.map((subQuestion, index) => (
        <div
          key={index}
          className="w-[562px] px-4 rounded justify-start items-start gap-2 inline-flex"
        >
          <div className="h-[230px] px-1 flex-col justify-between items-center inline-flex">
            <div className="w-3 h-3 relative" />
            <div className="w-[188px] h-[0px] origin-top-left rotate-90 border border-[#e6e3dd]"></div>
            <div className="w-3 h-3 relative overflow-hidden" />
          </div>
          <div className="grow shrink basis-0 flex-col justify-start items-start gap-2 inline-flex">
            <div className="self-stretch text-black text-base font-medium font-['KH Teka TRIAL'] leading-normal">
              {subQuestion.question}
            </div>
            <div className="self-stretch h-[52px] flex-col justify-start items-start gap-1 flex">
              <div className="self-stretch justify-start items-start inline-flex">
                <div className="text-[#4a4a4a] text-xs font-medium font-['KH Teka TRIAL'] leading-normal">
                  Searching
                </div>
              </div>
              <div className="self-stretch justify-start items-center gap-2 inline-flex">
                {subQuestion.sub_queries?.map((query, queryIndex) => (
                  <div
                    key={queryIndex}
                    className="px-2 bg-[#f1eee8] rounded-2xl justify-center items-center flex"
                  >
                    <div className="w-4 h-4 p-[3px] justify-center items-center gap-2 flex overflow-hidden" />
                    <div className="text-[#4a4a4a] text-xs font-medium font-['KH Teka TRIAL'] leading-normal">
                      {query.query}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Add more details here as needed */}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SubQuestionsDisplay;
