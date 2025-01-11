import React, { useState } from "react";
import { SubQuestionDetail } from "../interfaces";
import { FiChevronDown } from "react-icons/fi";
import { OnyxDocument } from "@/lib/search/interfaces";

interface SubQuestionsDisplayProps {
  subQuestions: SubQuestionDetail[];
  documents: OnyxDocument[];
}

export const SubQuestionDisplay = ({
  subQuestion,
  documents,
}: {
  subQuestion: SubQuestionDetail;
  documents: OnyxDocument[];
}) => {
  const [toggled, setToggled] = useState(false);
  return (
    <>
      {toggled ? (
        <div className="border-b border-neutral-900 pb-4 p-3 last:border-b-0 last:pb-0">
          <h4
            className="cursor-pointer font-medium mb-2"
            onClick={() => setToggled(!toggled)}
          >
            {subQuestion.question}
          </h4>
          <div className="text-sm text-neutral-600">
            <p>Searching:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {subQuestion.sub_queries?.map((query, queryIndex) => (
                <span
                  key={queryIndex}
                  className="px-2 py-1 rounded-full text-xs"
                >
                  {query.query}
                </span>
              ))}
            </div>
            <p>
              Reading:
              {documents
                .filter((doc) =>
                  subQuestion.context_docs?.top_documents?.some(
                    (contextDoc) => contextDoc.db_doc_id === doc.db_doc_id
                  )
                )
                ?.map((doc) => doc.semantic_identifier)
                .join(", ")
                .slice(0, 100)}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex justify-start items-center p-1 bg-neutral-50 cursor-pointer">
          <h3
            onClick={() => setToggled(!toggled)}
            className="text-lg font-semibold"
          >
            {subQuestion.question}
          </h3>
          <FiChevronDown />
        </div>
      )}
    </>
  );
};

const SubQuestionsDisplay: React.FC<SubQuestionsDisplayProps> = ({
  subQuestions,
  documents,
}) => {
  return (
    <div className="w-full border border-neutral-200 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center p-4 bg-white cursor-pointer">
        <h3 className="text-lg font-semibold">Subquestions</h3>
      </div>
      {subQuestions.map((subQuestion, index) => (
        <SubQuestionDisplay
          key={index}
          subQuestion={subQuestion}
          documents={documents}
        />
      ))}
    </div>
  );
};

export default SubQuestionsDisplay;
