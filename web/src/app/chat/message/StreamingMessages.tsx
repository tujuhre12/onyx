import { useState, useEffect } from "react";
import { SubQuestionDetail, SubQueryDetail } from "../interfaces";

enum StreamingState {
  QUESTION,
  SUB_QUERY,
  CONTEXT_DOCS,
  ANSWER,
  COMPLETE,
}

export const useStreamingMessages = (subQuestions: SubQuestionDetail[]) => {
  const [dynamicSubQuestions, setDynamicSubQuestions] = useState<
    SubQuestionDetail[]
  >([]);

  useEffect(() => {
    let currentSubQuestionIndex = 0;
    let currentSubQueryIndex = 0;
    let currentCharIndex = 0;
    let currentDocIndex = 0;
    let currentState: StreamingState = StreamingState.QUESTION;

    const loadNextPiece = () => {
      if (currentSubQuestionIndex >= subQuestions.length) {
        return;
      }

      const currentSubQuestion = subQuestions[currentSubQuestionIndex];

      setDynamicSubQuestions((prevDynamicSubQuestions) => {
        const updatedSubQuestions = [...prevDynamicSubQuestions];

        if (!updatedSubQuestions[currentSubQuestionIndex]) {
          updatedSubQuestions[currentSubQuestionIndex] = {
            level: currentSubQuestion.level,
            level_question_nr: currentSubQuestion.level_question_nr,
            question: "",
            answer: "",
            sub_queries: [],
            context_docs: { top_documents: [] },
          };
        }

        const currentDynamicSubQuestion =
          updatedSubQuestions[currentSubQuestionIndex];

        switch (currentState) {
          case StreamingState.QUESTION:
            if (currentCharIndex < currentSubQuestion.question.length) {
              currentDynamicSubQuestion.question =
                currentSubQuestion.question.slice(0, currentCharIndex + 1);
              currentCharIndex++;
            } else {
              currentState = StreamingState.SUB_QUERY;
              currentCharIndex = 0;
              currentSubQueryIndex = 0;
            }
            break;

          case StreamingState.SUB_QUERY:
            if (
              currentSubQueryIndex <
              (currentSubQuestion.sub_queries?.length || 0)
            ) {
              const currentSubQuery =
                currentSubQuestion.sub_queries![currentSubQueryIndex];
              if (
                !currentDynamicSubQuestion.sub_queries ||
                !currentDynamicSubQuestion.sub_queries[currentSubQueryIndex]
              ) {
                currentDynamicSubQuestion.sub_queries = [
                  ...(currentDynamicSubQuestion.sub_queries || []),
                  {
                    query: "",
                    query_id: currentSubQuery.query_id,
                    doc_ids: currentSubQuery.doc_ids,
                  },
                ];
              }
              if (currentCharIndex < currentSubQuery.query.length) {
                currentDynamicSubQuestion.sub_queries[
                  currentSubQueryIndex
                ].query = currentSubQuery.query.slice(0, currentCharIndex + 1);
                currentCharIndex++;
              } else {
                currentSubQueryIndex++;
                currentCharIndex = 0;
                if (
                  currentSubQueryIndex >=
                  (currentSubQuestion.sub_queries?.length || 0)
                ) {
                  currentState = StreamingState.CONTEXT_DOCS;
                }
              }
            } else {
              currentState = StreamingState.CONTEXT_DOCS;
            }
            break;

          case StreamingState.CONTEXT_DOCS:
            if (
              currentDocIndex <
              (currentSubQuestion.context_docs?.top_documents.length || 0)
            ) {
              const currentDoc =
                currentSubQuestion.context_docs!.top_documents[currentDocIndex];
              if (
                !currentDynamicSubQuestion.context_docs!.top_documents.some(
                  (doc) => doc.document_id === currentDoc.document_id
                )
              ) {
                currentDynamicSubQuestion.context_docs!.top_documents.push(
                  currentDoc
                );
              }
              currentDocIndex++;
            } else {
              currentState = StreamingState.ANSWER;
              currentDocIndex = 0;
            }
            break;

          case StreamingState.ANSWER:
            if (currentCharIndex < currentSubQuestion.answer.length) {
              currentDynamicSubQuestion.answer =
                currentSubQuestion.answer.slice(0, currentCharIndex + 1);
              currentCharIndex++;
            } else {
              currentState = StreamingState.COMPLETE;
            }
            break;

          case StreamingState.COMPLETE:
            currentSubQuestionIndex++;
            currentSubQueryIndex = 0;
            currentCharIndex = 0;
            currentDocIndex = 0;
            currentState = StreamingState.QUESTION;
            break;
        }

        return updatedSubQuestions;
      });

      if (currentState !== StreamingState.COMPLETE) {
        setTimeout(loadNextPiece, 15);
      }
    };

    loadNextPiece();
  }, [subQuestions]);

  return { dynamicSubQuestions };
};
