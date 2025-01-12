import { useState, useRef, useEffect } from "react";
import { SubQuestionDetail } from "../interfaces";
import { set } from "lodash";

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

  // Refs to store the "in-progress" data. We don’t want to lose track of indices or
  // dynamicSubQuestions every time React re-renders
  const dynamicSubQuestionsRef = useRef<SubQuestionDetail[]>([]);
  const currentSubQuestionIndexRef = useRef(0);
  const currentSubQueryIndexRef = useRef(0);
  const currentCharIndexRef = useRef(0);
  const currentDocIndexRef = useRef(0);
  const currentStateRef = useRef<StreamingState>(StreamingState.QUESTION);

  useEffect(() => {
    // Reset everything whenever subQuestions changes
    currentSubQuestionIndexRef.current = 0;
    currentSubQueryIndexRef.current = 0;
    currentCharIndexRef.current = 0;
    currentDocIndexRef.current = 0;
    currentStateRef.current = StreamingState.QUESTION;
    dynamicSubQuestionsRef.current = [];
    setDynamicSubQuestions([]);

    const loadNextPiece = () => {
      const { current: currentSubQuestionIndex } = currentSubQuestionIndexRef;
      if (currentSubQuestionIndex >= subQuestions.length) {
        return; // all subquestions done
      }

      const currentSubQuestion = subQuestions[currentSubQuestionIndex];
      if (!currentSubQuestion || !currentSubQuestion.question) {
        // Wait for the subquestion object to be built
        // setTimeout(loadNextPiece, 100);
        return;
      }

      // We always work off the ref:
      const updatedSubQuestions = [...dynamicSubQuestionsRef.current];

      // Ensure there's an entry for the current subquestion in updatedSubQuestions
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
      const state = currentStateRef.current;

      switch (state) {
        case StreamingState.QUESTION: {
          if (
            currentCharIndexRef.current < currentSubQuestion.question.length
          ) {
            currentDynamicSubQuestion.question =
              currentSubQuestion.question.slice(
                0,
                currentCharIndexRef.current + 1
              );
            currentCharIndexRef.current++;
          } else {
            currentStateRef.current = StreamingState.SUB_QUERY;
            currentCharIndexRef.current = 0;
            currentSubQueryIndexRef.current = 0;
          }
          break;
        }

        case StreamingState.SUB_QUERY: {
          if (
            !currentSubQuestion.sub_queries ||
            currentSubQuestion.sub_queries.length === 0
          ) {
            break;
          }

          const { current: currentSubQueryIndex } = currentSubQueryIndexRef;
          if (currentSubQueryIndex < currentSubQuestion.sub_queries.length) {
            const currentSubQuery =
              currentSubQuestion.sub_queries[currentSubQueryIndex];

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

            if (currentCharIndexRef.current < currentSubQuery.query.length) {
              currentDynamicSubQuestion.sub_queries[
                currentSubQueryIndex
              ].query = currentSubQuery.query.slice(
                0,
                currentCharIndexRef.current + 1
              );
              currentCharIndexRef.current++;
            } else {
              currentSubQueryIndexRef.current++;
              currentCharIndexRef.current = 0;
              // if we've exhausted all sub_queries, move on
              if (
                currentSubQueryIndexRef.current >=
                currentSubQuestion.sub_queries.length
              ) {
                currentStateRef.current = StreamingState.CONTEXT_DOCS;
              }
            }
          } else {
            currentStateRef.current = StreamingState.CONTEXT_DOCS;
          }
          break;
        }

        case StreamingState.CONTEXT_DOCS: {
          if (
            !currentSubQuestion.context_docs ||
            !currentSubQuestion.context_docs.top_documents
          ) {
            // Wait for context_docs to be built
            return;
          }

          console.log("updating context doc");

          const { current: currentDocIndex } = currentDocIndexRef;
          console.log(currentDocIndex);

          if (
            currentDocIndex <
            currentSubQuestion.context_docs.top_documents.length
          ) {
            const currentDoc =
              currentSubQuestion.context_docs.top_documents[currentDocIndex];
            // Only push if not present
            if (
              !currentDynamicSubQuestion.context_docs?.top_documents.some(
                (doc) => doc.document_id === currentDoc.document_id
              )
            ) {
              currentDynamicSubQuestion.context_docs!.top_documents.push(
                currentDoc
              );
            }
            currentDocIndexRef.current++;
          } else {
            currentStateRef.current = StreamingState.ANSWER;
            currentDocIndexRef.current = 0;
          }
          break;
        }

        case StreamingState.ANSWER: {
          if (!currentSubQuestion.answer) {
            // Wait for answer to be built
            break;
          }

          if (currentCharIndexRef.current < currentSubQuestion.answer.length) {
            currentDynamicSubQuestion.answer = currentSubQuestion.answer.slice(
              0,
              currentCharIndexRef.current + 1
            );
            currentCharIndexRef.current++;
          } else {
            currentStateRef.current = StreamingState.COMPLETE;
          }
          break;
        }

        case StreamingState.COMPLETE: {
          currentSubQuestionIndexRef.current++;
          currentSubQueryIndexRef.current = 0;
          currentCharIndexRef.current = 0;
          currentDocIndexRef.current = 0;
          currentStateRef.current = StreamingState.QUESTION;
          break;
        }
      }

      // Commit our local “in-progress” array to the ref
      dynamicSubQuestionsRef.current = updatedSubQuestions;
      // Then, actually set state for the UI
      setDynamicSubQuestions(updatedSubQuestions);

      // Keep going unless we just finished a COMPLETE cycle for one subquestion.
      if (currentStateRef.current !== StreamingState.COMPLETE) {
        if (currentStateRef.current === StreamingState.CONTEXT_DOCS) {
          // Move to next subquestion right away
          setTimeout(loadNextPiece, 1000);
        } else {
          setTimeout(loadNextPiece, 15);
        }
      } else {
        setTimeout(loadNextPiece, 100);
      }
    };

    // Start the streaming
    loadNextPiece();
  }, [subQuestions]);

  return { dynamicSubQuestions };
};

// import { useState, useEffect, useRef } from "react";
// import { SubQuestionDetail, SubQueryDetail } from "../interfaces";

// enum StreamingState {
//   QUESTION,
//   SUB_QUERY,
//   CONTEXT_DOCS,
//   ANSWER,
//   COMPLETE,
// }

// export const useStreamingMessages = (subQuestions: SubQuestionDetail[]) => {
//   const [dynamicSubQuestions, setDynamicSubQuestions] = useState<
//     SubQuestionDetail[]
//   >([]);

//   // Keep track of indices and streaming state in a ref.
//   // This avoids closure issues if React re-renders.
//   const streamingRefs = useRef({
//     currentSubQuestionIndex: 0,
//     currentSubQueryIndex: 0,
//     currentCharIndex: 0,
//     currentDocIndex: 0,
//     currentState: StreamingState.QUESTION,
//     timeoutId: 0 as unknown as NodeJS.Timeout, // for cleanup
//   });

//   useEffect(() => {
//     // Reset everything each time subQuestions is newly set
//     streamingRefs.current.currentSubQuestionIndex = 0;
//     streamingRefs.current.currentSubQueryIndex = 0;
//     streamingRefs.current.currentCharIndex = 0;
//     streamingRefs.current.currentDocIndex = 0;
//     streamingRefs.current.currentState = StreamingState.QUESTION;

//     let shouldCancel = false; // to handle cleanup if the component unmounts

//     const loadNextPiece = () => {
//       // If unmounted or a new effect triggers, stop
//       if (shouldCancel) return;

//       const {
//         currentSubQuestionIndex,
//         currentSubQueryIndex,
//         currentCharIndex,
//         currentDocIndex,
//         currentState,
//       } = streamingRefs.current;

//       if (currentSubQuestionIndex >= subQuestions.length) {
//         return;
//       }

//       const currentSubQuestion = subQuestions[currentSubQuestionIndex];

//       // If the subQuestion isn't ready, re-check soon
//       if (!currentSubQuestion || !currentSubQuestion.question) {
//         streamingRefs.current.timeoutId = setTimeout(loadNextPiece, 100);
//         return;
//       }

//       setDynamicSubQuestions((prevDynamicSubQuestions) => {
//         const updatedSubQuestions = [...prevDynamicSubQuestions];

//         if (!updatedSubQuestions[currentSubQuestionIndex]) {
//           updatedSubQuestions[currentSubQuestionIndex] = {
//             level: currentSubQuestion.level,
//             level_question_nr: currentSubQuestion.level_question_nr,
//             question: "",
//             answer: "",
//             sub_queries: [],
//             context_docs: { top_documents: [] },
//           };
//         }

//         const currentDynamicSubQuestion =
//           updatedSubQuestions[currentSubQuestionIndex];

//         switch (currentState) {
//           case StreamingState.QUESTION: {
//             if (currentCharIndex < currentSubQuestion.question.length) {
//               currentDynamicSubQuestion.question =
//                 currentSubQuestion.question.slice(0, currentCharIndex + 1);
//               streamingRefs.current.currentCharIndex += 1;
//             } else {
//               streamingRefs.current.currentState = StreamingState.SUB_QUERY;
//               streamingRefs.current.currentCharIndex = 0;
//               streamingRefs.current.currentSubQueryIndex = 0;
//             }
//             break;
//           }

//           case StreamingState.SUB_QUERY: {
//             if (
//               !currentSubQuestion.sub_queries ||
//               currentSubQuestion.sub_queries.length === 0
//             ) {
//               streamingRefs.current.timeoutId = setTimeout(loadNextPiece, 100);
//               return updatedSubQuestions;
//             }

//             if (currentSubQueryIndex < currentSubQuestion.sub_queries.length) {
//               const sq = currentSubQuestion.sub_queries[currentSubQueryIndex];
//               if (
//                 !currentDynamicSubQuestion.sub_queries ||
//                 !currentDynamicSubQuestion.sub_queries[currentSubQueryIndex]
//               ) {
//                 currentDynamicSubQuestion.sub_queries = [
//                   ...(currentDynamicSubQuestion.sub_queries || []),
//                   {
//                     query: "",
//                     query_id: sq.query_id,
//                     doc_ids: sq.doc_ids,
//                   },
//                 ];
//               }
//               if (currentCharIndex < sq.query.length) {
//                 currentDynamicSubQuestion.sub_queries[
//                   currentSubQueryIndex
//                 ].query = sq.query.slice(0, currentCharIndex + 1);
//                 streamingRefs.current.currentCharIndex += 1;
//               } else {
//                 streamingRefs.current.currentSubQueryIndex += 1;
//                 streamingRefs.current.currentCharIndex = 0;
//                 if (
//                   streamingRefs.current.currentSubQueryIndex >=
//                   currentSubQuestion.sub_queries.length
//                 ) {
//                   streamingRefs.current.currentState =
//                     StreamingState.CONTEXT_DOCS;
//                 }
//               }
//             } else {
//               streamingRefs.current.currentState = StreamingState.CONTEXT_DOCS;
//             }
//             break;
//           }

//           case StreamingState.CONTEXT_DOCS: {
//             if (
//               !currentSubQuestion.context_docs ||
//               !currentSubQuestion.context_docs.top_documents
//             ) {
//               streamingRefs.current.timeoutId = setTimeout(loadNextPiece, 100);
//               return updatedSubQuestions;
//             }

//             if (
//               currentDocIndex <
//               currentSubQuestion.context_docs.top_documents.length
//             ) {
//               const currentDoc =
//                 currentSubQuestion.context_docs.top_documents[currentDocIndex];
//               if (
//                 !currentDynamicSubQuestion.context_docs!.top_documents.some(
//                   (doc) => doc.document_id === currentDoc.document_id
//                 )
//               ) {
//                 currentDynamicSubQuestion.context_docs!.top_documents.push(
//                   currentDoc
//                 );
//               }
//               streamingRefs.current.currentDocIndex += 1;
//             } else {
//               streamingRefs.current.currentState = StreamingState.ANSWER;
//               streamingRefs.current.currentDocIndex = 0;
//             }
//             break;
//           }

//           case StreamingState.ANSWER: {
//             if (!currentSubQuestion.answer) {
//               streamingRefs.current.timeoutId = setTimeout(loadNextPiece, 100);
//               return updatedSubQuestions;
//             }

//             if (currentCharIndex < currentSubQuestion.answer.length) {
//               currentDynamicSubQuestion.answer =
//                 currentSubQuestion.answer.slice(0, currentCharIndex + 1);
//               streamingRefs.current.currentCharIndex += 1;
//             } else {
//               streamingRefs.current.currentState = StreamingState.COMPLETE;
//             }
//             break;
//           }

//           case StreamingState.COMPLETE: {
//             streamingRefs.current.currentSubQuestionIndex += 1;
//             streamingRefs.current.currentSubQueryIndex = 0;
//             streamingRefs.current.currentCharIndex = 0;
//             streamingRefs.current.currentDocIndex = 0;
//             streamingRefs.current.currentState = StreamingState.QUESTION;
//             break;
//           }
//         }

//         return updatedSubQuestions;
//       });

//       if (streamingRefs.current.currentState !== StreamingState.COMPLETE) {
//         streamingRefs.current.timeoutId = setTimeout(loadNextPiece, 40);
//       } else {
//         // Move on to the next piece immediately after we've reached COMPLETE
//         if (
//           streamingRefs.current.currentSubQuestionIndex < subQuestions.length
//         ) {
//           streamingRefs.current.timeoutId = setTimeout(loadNextPiece, 40);
//         }
//       }
//     };

//     loadNextPiece();

//     // Cleanup to avoid memory leaks
//     return () => {
//       shouldCancel = true;
//       clearTimeout(streamingRefs.current.timeoutId);
//     };
//   }, [subQuestions]);

//   return { dynamicSubQuestions };
// };
