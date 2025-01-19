import { useState, useRef, useEffect } from "react";
import { SubQuestionDetail } from "../interfaces";

export enum StreamingPhase {
  WAITING = "waiting",
  SUB_QUERIES = "sub_queries",
  CONTEXT_DOCS = "context_docs",
  ANSWER = "answer",
  COMPLETE = "complete",
}

export const StreamingPhaseText: Record<StreamingPhase, string> = {
  [StreamingPhase.WAITING]: "Extracting key terms",
  [StreamingPhase.SUB_QUERIES]: "Identifying additional questions",
  [StreamingPhase.CONTEXT_DOCS]: "Reading through more documents",
  [StreamingPhase.ANSWER]: "Generating new refined answer",
  [StreamingPhase.COMPLETE]: "Comparing results",
};

interface SubQuestionProgress {
  questionDone: boolean;
  questionCharIndex: number;
  currentPhase: StreamingPhase;
  // Track when we started this phase
  phaseStartTime: number;
  subQueryIndex: number;
  subQueryCharIndex: number;
  docIndex: number;
  lastDocTimestamp: number | null;
  answerCharIndex: number;
}

const PHASES_ORDER: StreamingPhase[] = [
  StreamingPhase.WAITING,
  StreamingPhase.SUB_QUERIES,
  StreamingPhase.CONTEXT_DOCS,
  StreamingPhase.ANSWER,
  StreamingPhase.COMPLETE,
];

const PHASE_MIN_MS = 800; // Minimum phase duration in ms

function canTransition(p: SubQuestionProgress) {
  return Date.now() - p.phaseStartTime >= PHASE_MIN_MS;
}

export function useOrderedPhases(externalPhase: StreamingPhase) {
  const [phaseQueue, setPhaseQueue] = useState<StreamingPhase[]>([]);
  const [displayedPhase, setDisplayedPhase] = useState<StreamingPhase>(
    StreamingPhase.WAITING
  );
  const lastDisplayTimestampRef = useRef<number>(Date.now());

  const getPhaseIndex = (phase: StreamingPhase) => {
    return PHASES_ORDER.indexOf(phase);
  };

  useEffect(() => {
    setPhaseQueue((prevQueue) => {
      const lastQueuedPhase =
        prevQueue.length > 0 ? prevQueue[prevQueue.length - 1] : displayedPhase;

      const lastQueuedIndex = getPhaseIndex(lastQueuedPhase);
      const externalIndex = getPhaseIndex(externalPhase);

      if (externalIndex <= lastQueuedIndex) {
        return prevQueue;
      }

      const missingPhases: StreamingPhase[] = [];
      for (let i = lastQueuedIndex + 1; i <= externalIndex; i++) {
        missingPhases.push(PHASES_ORDER[i]);
      }
      return [...prevQueue, ...missingPhases];
    });
  }, [externalPhase, displayedPhase]);

  useEffect(() => {
    if (phaseQueue.length === 0) return;
    let rafId: number;

    const processQueue = () => {
      const now = Date.now();
      const elapsed = now - lastDisplayTimestampRef.current;

      // Keep this at 1000ms from the original example (unchanged),
      // but you can adjust if you want a different visible time in *this* component.
      if (elapsed >= 1000) {
        setPhaseQueue((prevQueue) => {
          if (prevQueue.length > 0) {
            const [next, ...rest] = prevQueue;
            setDisplayedPhase(next);
            lastDisplayTimestampRef.current = Date.now();
            return rest;
          }
          return prevQueue;
        });
      }
      rafId = requestAnimationFrame(processQueue);
    };

    rafId = requestAnimationFrame(processQueue);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [phaseQueue]);

  return StreamingPhaseText[displayedPhase];
}

const DOC_DELAY_MS = 100;

export const useStreamingMessages = (
  subQuestions: SubQuestionDetail[],
  allowStreaming: () => void
) => {
  const [dynamicSubQuestions, setDynamicSubQuestions] = useState<
    SubQuestionDetail[]
  >([]);

  const subQuestionsRef = useRef<SubQuestionDetail[]>(subQuestions);
  useEffect(() => {
    subQuestionsRef.current = subQuestions;
  }, [subQuestions]);

  const dynamicSubQuestionsRef = useRef<SubQuestionDetail[]>([]);

  const progressRef = useRef<SubQuestionProgress[]>([]);

  useEffect(() => {
    subQuestions.forEach((sq, i) => {
      if (!progressRef.current[i]) {
        progressRef.current[i] = {
          questionDone: false,
          questionCharIndex: 0,
          // Start subQ #0 in SUB_QUERIES immediately, others in WAITING
          currentPhase:
            i === 0 ? StreamingPhase.SUB_QUERIES : StreamingPhase.WAITING,
          // We set the phase start time right away
          phaseStartTime: Date.now(),
          subQueryIndex: 0,
          subQueryCharIndex: 0,
          docIndex: 0,
          lastDocTimestamp: null,
          answerCharIndex: 0,
        };
      }

      if (!dynamicSubQuestionsRef.current[i]) {
        dynamicSubQuestionsRef.current[i] = {
          level: sq.level,
          level_question_nr: sq.level_question_nr,
          question: "",
          answer: "",
          sub_queries: [],
          context_docs: { top_documents: [] },
        };
      }
    });

    setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
  }, [subQuestions]);

  useEffect(() => {
    let stop = false;

    function loadNextPiece() {
      if (stop) return;

      const actualSubQs = subQuestionsRef.current;
      if (!actualSubQs || actualSubQs.length === 0) {
        setTimeout(loadNextPiece, 100);
        return;
      }

      // 1) Stream high-level questions in parallel
      let didStreamQuestion = false;
      for (let i = 0; i < actualSubQs.length; i++) {
        const sq = actualSubQs[i];
        const p = progressRef.current[i];
        const dynSQ = dynamicSubQuestionsRef.current[i];

        if (sq.question) {
          const nextIndex = p.questionCharIndex + 1;
          if (nextIndex <= sq.question.length) {
            dynSQ.question = sq.question.slice(0, nextIndex);
            p.questionCharIndex = nextIndex;
            if (nextIndex >= sq.question.length) {
              p.questionDone = true;
            }
            didStreamQuestion = true;
          }
        }
      }

      if (didStreamQuestion) {
        setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
        setTimeout(loadNextPiece, 2);
        return;
      }

      // 2) Handle SUB_QUERIES → CONTEXT_DOCS → ANSWER → COMPLETE
      for (let i = 0; i < actualSubQs.length; i++) {
        const sq = actualSubQs[i];
        const dynSQ = dynamicSubQuestionsRef.current[i];
        const p = progressRef.current[i];

        // Wait for subquestion #0 or the previous subquestion's progress
        if (p.currentPhase === StreamingPhase.WAITING) {
          if (i === 0) {
            // subquestion #0 can move on if 300ms has passed in WAITING (though it starts in SUB_QUERIES by default)
            if (canTransition(p)) {
              p.currentPhase = StreamingPhase.SUB_QUERIES;
              p.phaseStartTime = Date.now();
            }
          } else {
            const prevP = progressRef.current[i - 1];
            if (
              prevP.currentPhase === StreamingPhase.ANSWER ||
              prevP.currentPhase === StreamingPhase.COMPLETE
            ) {
              // Can only proceed if we've spent enough time in WAITING
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.SUB_QUERIES;
                p.phaseStartTime = Date.now();
              }
            }
          }
        }

        switch (p.currentPhase) {
          case StreamingPhase.SUB_QUERIES: {
            const subQueries = sq.sub_queries || [];
            const docs = sq.context_docs?.top_documents || [];
            const hasDocs = docs.length > 0;
            const hasAnswer = !!sq.answer?.length;

            // "Stream" the subqueries (in this code, it just sets them all at once)
            while (dynSQ.sub_queries!.length < subQueries.length) {
              dynSQ.sub_queries!.push({
                query: "",
                query_id: subQueries[0].query_id,
              });
            }
            for (let j = 0; j < subQueries.length; j++) {
              if (
                dynSQ.sub_queries![j].query.length < subQueries[j].query.length
              ) {
                dynSQ.sub_queries![j].query = subQueries[j].query;
              } else {
                console.log("NOT STEAMING");
              }
            }
            console.log(subQueries);

            // If we've "done" subqueries and see docs or an answer, move on — but only if 300ms have passed
            if (hasDocs || hasAnswer) {
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.CONTEXT_DOCS;
                p.phaseStartTime = Date.now();
                p.lastDocTimestamp = null;
              }
            }
            break;
          }

          case StreamingPhase.CONTEXT_DOCS: {
            const docs = sq.context_docs?.top_documents || [];
            const hasAnswer = !!sq.answer?.length;

            // If we see an answer but no docs, jump to ANSWER
            if (hasAnswer && docs.length === 0) {
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.ANSWER;
                p.phaseStartTime = Date.now();
              }
              break;
            }

            // Add all docs at once (same as original)
            if (p.docIndex < docs.length) {
              docs.forEach((docToAdd) => {
                const alreadyAdded = dynSQ.context_docs?.top_documents.some(
                  (d) => d.document_id === docToAdd.document_id
                );
                if (!alreadyAdded) {
                  dynSQ.context_docs?.top_documents.push(docToAdd);
                }
              });
              p.docIndex = docs.length;
              p.lastDocTimestamp = Date.now();
            }

            if (hasAnswer) {
              // Once we've added all docs and see an answer, move on *after* 300ms
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.ANSWER;
                p.phaseStartTime = Date.now();
              }
            }
            break;
          }

          case StreamingPhase.ANSWER: {
            const answerText = sq.answer || "";
            const remainingChars = answerText.length - p.answerCharIndex;
            const charsToStream = Math.min(remainingChars, 10);

            if (charsToStream > 0) {
              const nextIndex = p.answerCharIndex + charsToStream;
              dynSQ.answer = answerText.slice(0, nextIndex);
              p.answerCharIndex = nextIndex;

              // If we've streamed everything and it's "complete"
              if (nextIndex >= answerText.length && sq.is_complete) {
                // Only move to COMPLETE if 300ms has passed in ANSWER
                if (canTransition(p)) {
                  dynSQ.is_complete = true;
                  p.currentPhase = StreamingPhase.COMPLETE;
                  p.phaseStartTime = Date.now();
                  console.log("ANSWER COMPLETE");

                  // Check if this is the last subquestion at level 0
                  if (
                    sq.level === 0 &&
                    sq.level_question_nr ===
                      Math.max(
                        ...subQuestions
                          .filter((q) => q.level === 0)
                          .map((q) => q.level_question_nr)
                      )
                  ) {
                    console.log("ALLOW STREAMING");
                    allowStreaming();
                  } else {
                    console.log("DO NOT ALLOW STREAMING");
                  }
                }
              }
            }
            break;
          }

          case StreamingPhase.COMPLETE:
          case StreamingPhase.WAITING:
          default:
            break;
        }
      }

      setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
      setTimeout(loadNextPiece, 2);
    }

    loadNextPiece();

    return () => {
      stop = true;
    };
  }, []);

  return { dynamicSubQuestions };
};

// import { useState, useRef, useEffect } from "react";
// import { SubQuestionDetail } from "../interfaces";

// // Create a hook based on this that gets passed an argument which is one of the values of streamingPhase and updates the value it emits (based on streamingPhase text, BUT each phase must be displayed for at least 20 ms (so don't move onto next one until the previous one finished)

// export enum StreamingPhase {
//   WAITING = "waiting",
//   SUB_QUERIES = "sub_queries",
//   CONTEXT_DOCS = "context_docs",
//   ANSWER = "answer",
//   COMPLETE = "complete",
// }

// export const StreamingPhaseText: Record<StreamingPhase, string> = {
//   [StreamingPhase.WAITING]: "Extracting key terms",
//   [StreamingPhase.SUB_QUERIES]: "Identifying additional questions",
//   [StreamingPhase.CONTEXT_DOCS]: "Reading through more documents",
//   [StreamingPhase.ANSWER]: "Generating new refined answer",
//   [StreamingPhase.COMPLETE]: "Comparing results",
// };

// interface SubQuestionProgress {
//   // Tracks if we're done with the high-level question
//   questionDone: boolean;
//   // How far we've typed in the question so far
//   questionCharIndex: number;
//   // Current streaming phase (subQueries → contextDocs → answer)
//   currentPhase: StreamingPhase;
//   // Sub-query streaming progress
//   subQueryIndex: number;
//   subQueryCharIndex: number;
//   // Context docs streaming progress
//   docIndex: number;
//   lastDocTimestamp: number | null;
//   // Answer streaming progress
//   answerCharIndex: number;
// }

// /**
//  * Hook that manages displaying the current phase text.
//  * Even if `phase` is updated rapidly from the outside,
//  * each phase will be shown for at least MIN_PHASE_DISPLAY_TIME (20ms)
//  * before updating to the next.
//  *
//  * @param phase        - the current streaming phase value
//  * @param subQuestions - the array of SubQuestionDetail (unused in this example,
//  *                       but included to show how you might incorporate them)
//  *
//  * @returns the text corresponding to the phase currently being displayed
//  */
// const PHASES_ORDER: StreamingPhase[] = [
//   StreamingPhase.WAITING,
//   StreamingPhase.SUB_QUERIES,
//   StreamingPhase.CONTEXT_DOCS,
//   StreamingPhase.ANSWER,
//   StreamingPhase.COMPLETE,
// ];

// export function useOrderedPhases(externalPhase: StreamingPhase) {
//   // We'll keep a queue of phases we still need to display
//   const [phaseQueue, setPhaseQueue] = useState<StreamingPhase[]>([]);
//   // This is the phase currently shown on screen
//   const [displayedPhase, setDisplayedPhase] = useState<StreamingPhase>(
//     StreamingPhase.WAITING
//   );

//   // Keep track of when we last switched the displayedPhase
//   const lastDisplayTimestampRef = useRef<number>(Date.now());

//   /**
//    * Helper: find the index in PHASES_ORDER
//    */
//   const getPhaseIndex = (phase: StreamingPhase) => {
//     return PHASES_ORDER.indexOf(phase);
//   };

//   /**
//    * Add any missing phases in the correct order to the queue
//    * if externalPhase is ahead of our last queued item.
//    */
//   useEffect(() => {
//     setPhaseQueue((prevQueue) => {
//       // We'll figure out the highest-phase we've queued so far
//       const lastQueuedPhase =
//         prevQueue.length > 0 ? prevQueue[prevQueue.length - 1] : displayedPhase;

//       const lastQueuedIndex = getPhaseIndex(lastQueuedPhase);
//       const externalIndex = getPhaseIndex(externalPhase);

//       // If external is behind or the same as lastQueued, do nothing
//       if (externalIndex <= lastQueuedIndex) {
//         return prevQueue;
//       }

//       // Otherwise, gather the missing phases from just after lastQueued to the external index
//       const missingPhases: StreamingPhase[] = [];
//       for (let i = lastQueuedIndex + 1; i <= externalIndex; i++) {
//         missingPhases.push(PHASES_ORDER[i]);
//       }
//       return [...prevQueue, ...missingPhases];
//     });
//     // We only care about changes to externalPhase
//     // displayedPhase is covered in the queue-processing effect below
//   }, [externalPhase, displayedPhase]);

//   /**
//    * Process the queue in a frame loop, ensuring each item
//    * is shown for at least MIN_PHASE_DISPLAY_TIME ms.
//    */
//   useEffect(() => {
//     if (phaseQueue.length === 0) return;

//     let rafId: number;

//     const processQueue = () => {
//       const now = Date.now();
//       const elapsed = now - lastDisplayTimestampRef.current;

//       if (elapsed >= 1000) {
//         // We can move on to the next phase in the queue
//         setPhaseQueue((prevQueue) => {
//           if (prevQueue.length > 0) {
//             const [next, ...rest] = prevQueue;
//             // The first item in the queue is the next displayed
//             setDisplayedPhase(next);
//             lastDisplayTimestampRef.current = Date.now();
//             return rest;
//           }
//           return prevQueue;
//         });
//       }
//       // If not enough time has passed, keep waiting:
//       rafId = requestAnimationFrame(processQueue);
//     };

//     // Start checking
//     rafId = requestAnimationFrame(processQueue);

//     return () => {
//       if (rafId) {
//         cancelAnimationFrame(rafId);
//       }
//     };
//   }, [phaseQueue]);

//   return StreamingPhaseText[displayedPhase];
// }

// const DOC_DELAY_MS = 100;

// export const useStreamingMessages = (
//   subQuestions: SubQuestionDetail[],
//   allowStreaming: () => void
// ) => {
//   // The array we show the user, progressively revealed
//   const [dynamicSubQuestions, setDynamicSubQuestions] = useState<
//     SubQuestionDetail[]
//   >([]);

//   // Keep the latest subQuestions in a ref for streaming logic
//   const subQuestionsRef = useRef<SubQuestionDetail[]>(subQuestions);
//   useEffect(() => {
//     subQuestionsRef.current = subQuestions;
//   }, [subQuestions]);

//   // Our in-progress "dynamic" array
//   const dynamicSubQuestionsRef = useRef<SubQuestionDetail[]>([]);

//   // Per-subquestion streaming progress
//   const progressRef = useRef<SubQuestionProgress[]>([]);

//   /**
//    * This effect ensures that if subQuestions is updated with
//    * new items at the end, we create progress entries for them.
//    * We do NOT reset progress for older items (so they keep streaming).
//    */
//   useEffect(() => {
//     subQuestions.forEach((sq, i) => {
//       // If we *already* have a progress object for subquestion i,
//       // do nothing—let it continue wherever it was.
//       if (!progressRef.current[i]) {
//         // This is a *new* subquestion we haven't seen before, so create a fresh object:
//         progressRef.current[i] = {
//           questionDone: false,
//           questionCharIndex: 0,
//           // For subquestion #0, start in SUB_QUERIES;
//           // for others, start in WAITING until the previous subQ hits ANSWER/COMPLETE.
//           currentPhase:
//             i === 0 ? StreamingPhase.SUB_QUERIES : StreamingPhase.WAITING,
//           subQueryIndex: 0,
//           subQueryCharIndex: 0,
//           docIndex: 0,
//           lastDocTimestamp: null,
//           answerCharIndex: 0,
//         };
//       }

//       // Also ensure our dynamic array has a slot for index i
//       if (!dynamicSubQuestionsRef.current[i]) {
//         dynamicSubQuestionsRef.current[i] = {
//           level: sq.level,
//           level_question_nr: sq.level_question_nr,
//           question: "",
//           answer: "",
//           sub_queries: [],
//           context_docs: { top_documents: [] },
//         };
//       }
//     });

//     // Force update so the UI can show placeholders for new subquestions
//     setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
//   }, [subQuestions]);

//   /**
//    * Main streaming loop:
//    *  - Streams each subquestion's `question` in parallel.
//    *  - Once all question text is done (for each subquestion),
//    *    it processes phases SUB_QUERIES → CONTEXT_DOCS → ANSWER → COMPLETE,
//    *    though subquestion #i waits for subquestion #(i-1) to at least
//    *    start ANSWER before moving beyond WAITING.
//    */
//   useEffect(() => {
//     let stop = false; // set to true if unmounting

//     function loadNextPiece() {
//       if (stop) return;

//       const actualSubQs = subQuestionsRef.current;
//       if (!actualSubQs || actualSubQs.length === 0) {
//         // No subquestions at all, check again soon
//         setTimeout(loadNextPiece, 100);
//         return;
//       }

//       // 1) Stream high-level questions in parallel
//       let didStreamQuestion = false;
//       for (let i = 0; i < actualSubQs.length; i++) {
//         const sq = actualSubQs[i];
//         const p = progressRef.current[i];
//         const dynSQ = dynamicSubQuestionsRef.current[i];

//         // If we haven't typed the entire question yet, or even if we have, try to type one more char
//         if (sq.question) {
//           const nextIndex = p.questionCharIndex + 1;
//           if (nextIndex <= sq.question.length) {
//             dynSQ.question = sq.question.slice(0, nextIndex);
//             p.questionCharIndex = nextIndex;
//             if (nextIndex >= sq.question.length) {
//               p.questionDone = true;
//             }
//             didStreamQuestion = true;
//           }
//         }
//       }

//       // If we typed any question chars, let's pause briefly and come back
//       // so subqueries/docs/answers don't block question streaming
//       if (didStreamQuestion) {
//         setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
//         setTimeout(loadNextPiece, 2);
//         return;
//       }

//       // 2) If no question chars were typed, proceed with SUB_QUERIES → CONTEXT_DOCS → ANSWER
//       for (let i = 0; i < actualSubQs.length; i++) {
//         const sq = actualSubQs[i];
//         const dynSQ = dynamicSubQuestionsRef.current[i];
//         const p = progressRef.current[i];

//         // If this subquestion is WAITING, see if we can transition
//         if (p.currentPhase === StreamingPhase.WAITING) {
//           if (i === 0) {
//             // subquestion #0 can start immediately
//             p.currentPhase = StreamingPhase.SUB_QUERIES;
//           } else {
//             // Others wait until subquestion #(i-1) is in ANSWER or COMPLETE
//             const prevP = progressRef.current[i - 1];
//             if (
//               prevP.currentPhase === StreamingPhase.ANSWER ||
//               prevP.currentPhase === StreamingPhase.COMPLETE
//             ) {
//               p.currentPhase = StreamingPhase.SUB_QUERIES;
//             }
//           }
//         }

//         switch (p.currentPhase) {
//           case StreamingPhase.SUB_QUERIES: {
//             const subQueries = sq.sub_queries || [];
//             const docs = sq.context_docs?.top_documents || [];
//             const hasDocs = docs.length > 0;
//             const hasAnswer = !!sq.answer?.length;

//             // Type subqueries in order, one char at a time
//             // if (p.subQueryIndex < subQueries.length) {
//             // const currentSubQ = subQueries[p.subQueryIndex];
//             while (dynSQ.sub_queries!.length < subQueries.length) {
//               // Create an empty subquery in dynamic
//               dynSQ.sub_queries!.push({
//                 query: "",
//                 query_id: subQueries[0].query_id,
//               });
//             }

//             // Update all dynamic subqueries if they're shorter than current subqueries
//             for (let j = 0; j < subQueries.length; j++) {
//               if (
//                 dynSQ.sub_queries![j].query.length < subQueries[j].query.length
//               ) {
//                 dynSQ.sub_queries![j].query = subQueries[j].query;
//               } else {
//                 console.log("NOT STEAMING");
//               }
//             }
//             console.log(subQueries);

//             // const dynSubQ = dynSQ.sub_queries![p.subQueryIndex];
//             // const nextIndex = p.subQueryCharIndex + 1;

//             // dynSubQ.query = currentSubQ.query
//             // p.subQueryCharIndex = nextIndex;

//             // if (nextIndex >= currentSubQ.query.length) {
//             // p.subQueryIndex++;
//             // p.subQueryCharIndex = 0;
//             // }

//             // const dynSubQ = dynSQ.sub_queries![p.subQueryIndex];
//             // const nextIndex = p.subQueryCharIndex + 1;

//             // dynSubQ.query = currentSubQ.query.slice(0, nextIndex);
//             // p.subQueryCharIndex = nextIndex;

//             // if (nextIndex >= currentSubQ.query.length) {
//             //   p.subQueryIndex++;
//             //   p.subQueryCharIndex = 0;
//             // }
//             // }
//             // else

//             if (hasDocs || hasAnswer) {
//               // If we've typed all known subqueries, and we see docs or answer,
//               // we move on to CONTEXT_DOCS
//               p.currentPhase = StreamingPhase.CONTEXT_DOCS;
//               p.lastDocTimestamp = null; // reset doc timestamp
//             }
//             break;
//           }

//           case StreamingPhase.CONTEXT_DOCS: {
//             const docs = sq.context_docs?.top_documents || [];
//             const hasAnswer = !!sq.answer?.length;

//             // If we see an answer but no docs, jump to ANSWER
//             if (hasAnswer && docs.length === 0) {
//               p.currentPhase = StreamingPhase.ANSWER;
//               break;
//             }

//             // Add all docs at once
//             if (p.docIndex < docs.length) {
//               docs.forEach((docToAdd) => {
//                 const alreadyAdded = dynSQ.context_docs?.top_documents.some(
//                   (d) => d.document_id === docToAdd.document_id
//                 );
//                 if (!alreadyAdded) {
//                   dynSQ.context_docs?.top_documents.push(docToAdd);
//                 }
//               });
//               p.docIndex = docs.length;
//               p.lastDocTimestamp = Date.now();
//             }

//             if (hasAnswer) {
//               // Once we've added all docs and see an answer, move on
//               setTimeout(() => {
//                 p.currentPhase = StreamingPhase.ANSWER;
//               }, 100);
//             }
//             break;

//             // if (p.docIndex < docs.length) {
//             //   const now = Date.now();
//             //   if (
//             //     p.lastDocTimestamp === null ||
//             //     now - p.lastDocTimestamp >= DOC_DELAY_MS
//             //   ) {
//             //     const docToAdd = docs[p.docIndex];
//             //     const alreadyAdded = dynSQ.context_docs?.top_documents.some(
//             //       (d) => d.document_id === docToAdd.document_id
//             //     );
//             //     if (!alreadyAdded) {
//             //       dynSQ.context_docs?.top_documents.push(docToAdd);
//             //     }
//             //     p.docIndex++;
//             //     p.lastDocTimestamp = now;
//             //   }
//             // } else if (hasAnswer) {
//             //   // Once we've added all known docs and see an answer, move on
//             //   p.currentPhase = StreamingPhase.ANSWER;
//             // }
//             // break;
//           }

//           case StreamingPhase.ANSWER: {
//             const answerText = sq.answer || "";
//             const remainingChars = answerText.length - p.answerCharIndex;
//             const charsToStream = Math.min(remainingChars, 10); // Stream up to 10 characters at a time

//             if (charsToStream > 0) {
//               const nextIndex = p.answerCharIndex + charsToStream;
//               dynSQ.answer = answerText.slice(0, nextIndex);
//               p.answerCharIndex = nextIndex;

//               // If we've streamed the entire answer and it's considered "complete"
//               if (nextIndex >= answerText.length && sq.is_complete) {
//                 dynSQ.is_complete = true;

//                 p.currentPhase = StreamingPhase.COMPLETE;
//                 console.log("ANSWER COMPLETE");

//                 // Check if this is the last subquestion at level 0
//                 if (
//                   sq.level === 0 &&
//                   sq.level_question_nr ===
//                     Math.max(
//                       ...subQuestions
//                         .filter((q) => q.level === 0)
//                         .map((q) => q.level_question_nr)
//                     )
//                 ) {
//                   console.log("ALLOW STREAMING");
//                   console.log(sq.level_question_nr);
//                   console.log(
//                     Math.max(
//                       ...subQuestions
//                         .filter((q) => q.level === 0)
//                         .map((q) => q.level_question_nr)
//                     )
//                   );
//                   allowStreaming();
//                 } else {
//                   console.log("ALLOW STREAMING");
//                   console.log(sq.level_question_nr);
//                   console.log(
//                     Math.max(
//                       ...subQuestions
//                         .filter((q) => q.level === 0)
//                         .map((q) => q.level_question_nr)
//                     )
//                   );
//                   console.log("DO NOT ALLOW STREAMING");
//                 }
//               }
//             }
//             break;
//           }

//           case StreamingPhase.COMPLETE:
//           case StreamingPhase.WAITING:
//           default:
//             // No streaming needed in these phases
//             break;
//         }
//       }

//       // Update UI
//       setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);

//       setTimeout(loadNextPiece, 2);
//     }

//     loadNextPiece();

//     return () => {
//       stop = true;
//     };
//   }, []);

//   return { dynamicSubQuestions };
// };
