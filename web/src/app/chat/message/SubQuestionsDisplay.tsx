import React, { useCallback, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { OnyxDocument } from "@/lib/search/interfaces";
import { SubQuestionDetail } from "../interfaces";
import { SourceChip2 } from "../input/ChatInputBar";
import { ResultIcon } from "@/components/chat_search/sources/SourceCard";
import { openDocument } from "@/lib/search/utils";
import { SourcesDisplay } from "./SourcesDisplay";
import ReactMarkdown from "react-markdown";
import { MemoizedAnchor } from "./MemoizedTextComponents";
import { MemoizedParagraph } from "./MemoizedTextComponents";
import { extractCodeText } from "./codeUtils";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface SubQuestionsDisplayProps {
  subQuestions: SubQuestionDetail[];
  documents: OnyxDocument[];
  toggleDocumentSelection: () => void;
  setPresentingDocument: (document: OnyxDocument) => void;
}

const SubQuestionDisplay: React.FC<{
  subQuestion: SubQuestionDetail;
  documents: OnyxDocument[];
  isLast: boolean;
  isFirst: boolean;
  setPresentingDocument: (document: OnyxDocument) => void;
}> = ({ subQuestion, documents, isLast, isFirst, setPresentingDocument }) => {
  const [toggled, setToggled] = useState(true);

  const paragraphCallback = useCallback(
    (props: any) => (
      <MemoizedParagraph fontSize={"sm"}>{props.children}</MemoizedParagraph>
    ),
    []
  );

  const anchorCallback = useCallback(
    (props: any) => (
      <MemoizedAnchor
        updatePresentingDocument={setPresentingDocument!}
        docs={documents}
      >
        {props.children}
      </MemoizedAnchor>
    ),
    [documents]
  );

  const markdownComponents = useMemo(
    () => ({
      a: anchorCallback,
      p: paragraphCallback,
      code: ({ node, className, children }: any) => {
        const codeText = extractCodeText(
          node,
          subQuestion.answer as string,
          children
        );

        return (
          <CodeBlock className={className} codeText={codeText}>
            {children}
          </CodeBlock>
        );
      },
    }),
    [anchorCallback, paragraphCallback, subQuestion.answer]
  );

  const renderedMarkdown = useMemo(() => {
    return (
      <ReactMarkdown
        className="prose max-w-full text-base"
        components={markdownComponents}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {subQuestion.answer as string}
      </ReactMarkdown>
    );
  }, [subQuestion.answer, markdownComponents]);

  return (
    <div className="relative">
      <div
        className={`absolute left-[5px] ${
          isFirst ? "top-[9px]" : "top-0"
        } bottom-0 w-[2px] bg-neutral-200 ${isLast ? "h-full" : ""}`}
      />
      <div className="flex items-start pb-4">
        <div
          className={`absolute left-0 w-3 h-3 rounded-full mt-[9px] z-10 ${
            subQuestion.answer
              ? "bg-neutral-700"
              : "bg-neutral-700 rotating-circle"
          }`}
        />
        <div className="ml-8">
          <div
            className="flex items-center py-1 cursor-pointer"
            onClick={() => setToggled(!toggled)}
          >
            <div className="text-black text-base font-medium leading-normal">
              {subQuestion.question}
            </div>
          </div>
          {toggled && (
            <div className="pl-0 pb-2">
              <div className="mb-4 flex flex-col gap-2">
                <div className="text-[#4a4a4a] text-xs font-medium leading-normal">
                  Searching
                </div>
                <div className="flex flex-wrap gap-2">
                  {subQuestion.sub_queries?.map((query, queryIndex) => (
                    <SourceChip2
                      key={queryIndex}
                      icon={<FiSearch size={10} />}
                      title={query.query}
                      includeTooltip
                    />
                  ))}
                </div>
              </div>
              <div className="mb-4  flex flex-col gap-2">
                <div className="text-[#4a4a4a] text-xs font-medium leading-normal">
                  Reading
                </div>
                <div className="flex flex-wrap gap-2">
                  {documents
                    .filter((doc) =>
                      subQuestion.context_docs?.top_documents?.some(
                        (contextDoc) =>
                          contextDoc.document_id === doc.document_id
                      )
                    )
                    .slice(0, 10)
                    .map((doc, docIndex) => {
                      const truncatedIdentifier =
                        doc.semantic_identifier?.slice(0, 20) || "";
                      return (
                        <SourceChip2
                          onClick={() =>
                            openDocument(doc, setPresentingDocument)
                          }
                          key={docIndex}
                          icon={<ResultIcon doc={doc} size={10} />}
                          title={`${truncatedIdentifier}${
                            truncatedIdentifier.length === 20 ? "..." : ""
                          }`}
                        />
                      );
                    })}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="text-[#4a4a4a] text-xs font-medium leading-normal">
                  Analysis
                </div>
                <div className="flex flex-wrap gap-2">{renderedMarkdown}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SubQuestionsDisplay: React.FC<SubQuestionsDisplayProps> = ({
  subQuestions,
  documents,
  toggleDocumentSelection,
  setPresentingDocument,
}) => {
  return (
    <div className="w-full">
      <style jsx global>{`
        @keyframes rotate {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .rotating-circle::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 2px solid transparent;
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: rotate 1s linear infinite;
        }
      `}</style>
      <div className="relative">
        {subQuestions.map((subQuestion, index) => (
          <SubQuestionDisplay
            key={index}
            subQuestion={subQuestion}
            documents={documents}
            isLast={index === subQuestions.length - 1}
            isFirst={index === 0}
            setPresentingDocument={setPresentingDocument}
          />
        ))}
      </div>
      {subQuestions.length > 0 && (
        <SourcesDisplay
          toggleDocumentSelection={toggleDocumentSelection}
          documents={documents}
        />
      )}
    </div>
  );
};

export default SubQuestionsDisplay;
