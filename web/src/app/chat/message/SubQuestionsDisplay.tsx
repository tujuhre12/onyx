import React, { useState } from "react";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";
import { OnyxDocument } from "@/lib/search/interfaces";
import { BsFileEarmarkText } from "react-icons/bs";
import { AiOutlineFileSearch } from "react-icons/ai";
import { SubQuestionDetail } from "../interfaces";

interface SubQuestionsDisplayProps {
  subQuestions: SubQuestionDetail[];
  documents: OnyxDocument[];
}

const SubQuestionDisplay: React.FC<{
  subQuestion: SubQuestionDetail;
  documents: OnyxDocument[];
  index: number;
}> = ({ subQuestion, documents, index }) => {
  const [toggled, setToggled] = useState(false);

  return (
    <div className="mb-2 last:mb-0">
      <div
        className={`flex justify-between items-center p-3 bg-gray-100 rounded-lg cursor-pointer ${
          toggled ? "mb-2" : ""
        }`}
        onClick={() => setToggled(!toggled)}
      >
        <div className="flex items-center">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white mr-3">
            {index}
          </div>
          <h3 className="text-sm font-medium">{subQuestion.question}</h3>
        </div>
        {toggled ? <FiChevronUp /> : <FiChevronDown />}
      </div>
      {toggled && (
        <div className="px-3 py-2">
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1">Searching</p>
            <div className="flex flex-wrap gap-2">
              {subQuestion.sub_queries?.map((query, queryIndex) => (
                <span
                  key={queryIndex}
                  className="px-2 py-1 bg-gray-100 rounded-full text-xs flex items-center"
                >
                  <FiSearch className="mr-1" />
                  {query.query}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Reading</p>
            <div className="flex flex-wrap gap-2">
              {documents
                .filter((doc) =>
                  subQuestion.context_docs?.top_documents?.some(
                    (contextDoc) => contextDoc.db_doc_id === doc.db_doc_id
                  )
                )
                .map((doc, docIndex) => {
                  const truncatedIdentifier =
                    doc.semantic_identifier?.slice(0, 20) || "";
                  return (
                    <span
                      key={docIndex}
                      className="px-2 py-1 bg-gray-100 rounded-full text-xs flex items-center"
                    >
                      <BsFileEarmarkText className="mr-1" />
                      {truncatedIdentifier}
                      {truncatedIdentifier.length === 20 ? "..." : ""}
                    </span>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SubQuestionsDisplay: React.FC<SubQuestionsDisplayProps> = ({
  subQuestions,
  documents,
}) => {
  return (
    <div className="w-full border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center p-4 bg-white">
        <AiOutlineFileSearch className="text-gray-500 mr-2" />
        <h3 className="text-lg font-semibold">Subquestions</h3>
      </div>
      <div className="p-4 bg-white">
        {subQuestions.map((subQuestion, index) => (
          <SubQuestionDisplay
            key={index}
            subQuestion={subQuestion}
            documents={documents}
            index={index + 1}
          />
        ))}
      </div>
    </div>
  );
};

export default SubQuestionsDisplay;
