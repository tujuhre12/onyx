import { useState, useRef, useEffect } from "react";
import { SubQuestionDetail } from "../interfaces";

enum SubQStreamingPhase {
  SUB_QUERIES = "sub_queries",
  CONTEXT_DOCS = "context_docs",
  ANSWER = "answer",
  COMPLETE = "complete",
}

interface SubQuestionProgress {
  // Tracks whether the "question" field is fully streamed
  questionDone: boolean;
  // Index into the question string
  questionCharIndex: number;
  // Which phase of subquestion-level streaming we’re in
  currentPhase: SubQStreamingPhase;
  // Subqueries
  subQueryIndex: number;
  subQueryCharIndex: number;
  // Docs
  docIndex: number;
  // Answer
  answerCharIndex: number;
}

export const useStreamingMessages = (subQuestions: SubQuestionDetail[]) => {
  const [dynamicSubQuestions, setDynamicSubQuestions] = useState<
    SubQuestionDetail[]
  >([]);

  // Store latest subQuestions in a ref
  const subQuestionsRef = useRef<SubQuestionDetail[]>(subQuestions);
  useEffect(() => {
    subQuestionsRef.current = subQuestions;
  }, [subQuestions]);

  // Our “in-progress” array for rendering
  const dynamicSubQuestionsRef = useRef<SubQuestionDetail[]>([]);
  // Per-subquestion progress
  const progressRef = useRef<SubQuestionProgress[]>([]);
  // Index of the subquestion we’re actively streaming (SUB_QUERIES→DOCS→ANSWER)
  const activeSubQIndexRef = useRef<number>(0);

  useEffect(() => {
    // Reset whenever subQuestions changes
    dynamicSubQuestionsRef.current = [];
    setDynamicSubQuestions([]);
    activeSubQIndexRef.current = 0;

    // Initialize progress for each subquestion
    progressRef.current = subQuestions.map(() => ({
      questionDone: false,
      questionCharIndex: 0,
      currentPhase: SubQStreamingPhase.SUB_QUERIES,
      subQueryIndex: 0,
      subQueryCharIndex: 0,
      docIndex: 0,
      answerCharIndex: 0,
    }));

    // Helper to ensure dynamicSubQuestions has an entry for subquestion i
    function ensureDynamicSlot(i: number): SubQuestionDetail {
      const dsq = dynamicSubQuestionsRef.current;
      if (!dsq[i]) {
        dsq[i] = {
          level: subQuestionsRef.current[i].level,
          level_question_nr: subQuestionsRef.current[i].level_question_nr,
          question: "",
          answer: "",
          sub_queries: [],
          context_docs: { top_documents: [] },
        };
      }
      return dsq[i];
    }

    function loadNextPiece() {
      const subQs = subQuestionsRef.current;
      if (!subQs || subQs.length === 0) {
        return; // nothing to stream
      }

      // ------------------------------------------------------
      // 1) Stream one character of each incomplete question (in parallel)
      //    If we do stream any question chars, we skip the subquestion-phase logic
      //    for this iteration, to keep question streaming "live" as soon as it arrives.
      // ------------------------------------------------------
      let didStreamQuestion = false;
      for (let i = 0; i < progressRef.current.length; i++) {
        const p = progressRef.current[i];
        const sq = subQs[i];
        // If there's a question to stream and it's not done, do 1 char
        if (!p.questionDone && sq.question) {
          const dynSQ = ensureDynamicSlot(i);
          const nextIndex = p.questionCharIndex + 1;
          dynSQ.question = sq.question.slice(0, nextIndex);
          p.questionCharIndex = nextIndex;

          if (p.questionCharIndex >= sq.question.length) {
            p.questionDone = true;
          }
          didStreamQuestion = true;
        }
      }

      if (didStreamQuestion) {
        // Commit changes
        dynamicSubQuestionsRef.current = [...dynamicSubQuestionsRef.current];
        setDynamicSubQuestions(dynamicSubQuestionsRef.current);

        // Stream next question character(s) in ~15ms
        setTimeout(loadNextPiece, 15);
        return;
      }

      // ------------------------------------------------------
      // 2) If no more incomplete questions, proceed with
      //    subqueries → context docs → answer for the "active" subquestion
      // ------------------------------------------------------
      const { current: activeIndex } = activeSubQIndexRef;
      if (activeIndex >= subQs.length) {
        // All subquestions are done
        return;
      }

      const p = progressRef.current[activeIndex];
      const sq = subQs[activeIndex];
      const dynSQ = ensureDynamicSlot(activeIndex);

      switch (p.currentPhase) {
        case SubQStreamingPhase.SUB_QUERIES: {
          // If no sub_queries or we've finished them, move on
          if (!sq.sub_queries || sq.sub_queries.length === 0) {
            p.currentPhase = SubQStreamingPhase.CONTEXT_DOCS;
            break;
          }
          if (p.subQueryIndex >= sq.sub_queries.length) {
            p.currentPhase = SubQStreamingPhase.CONTEXT_DOCS;
            break;
          }

          // Otherwise, stream subquery #p.subQueryIndex
          const currentSubQ = sq.sub_queries[p.subQueryIndex];
          // Ensure dynamic has a slot for it
          while ((dynSQ.sub_queries?.length || 0) <= p.subQueryIndex) {
            // add an empty subquery in dynamic
            dynSQ.sub_queries!.push({
              query: "",
              query_id: sq.sub_queries[dynSQ.sub_queries!.length].query_id,
            });
          }

          const dynSubQ = dynSQ.sub_queries![p.subQueryIndex];
          const nextIndex = p.subQueryCharIndex + 1;
          dynSubQ.query = currentSubQ.query.slice(0, nextIndex);
          p.subQueryCharIndex = nextIndex;

          if (p.subQueryCharIndex >= currentSubQ.query.length) {
            p.subQueryIndex++;
            p.subQueryCharIndex = 0;
          }

          break;
        }

        case SubQStreamingPhase.CONTEXT_DOCS: {
          const docs = sq.context_docs?.top_documents || [];
          if (p.docIndex >= docs.length) {
            // done with docs, move on to answer
            p.currentPhase = SubQStreamingPhase.ANSWER;
            break;
          }

          // push one doc at a time
          const docToAdd = docs[p.docIndex];
          if (
            !dynSQ.context_docs?.top_documents.some(
              (d) => d.document_id === docToAdd.document_id
            )
          ) {
            dynSQ.context_docs?.top_documents.push(docToAdd);
          }
          p.docIndex++;
          break;
        }

        case SubQStreamingPhase.ANSWER: {
          // Stream one character of the answer
          const nextIndex = p.answerCharIndex + 1;

          if (sq.answer) {
            dynSQ.answer = sq.answer.slice(0, nextIndex);
            p.answerCharIndex = nextIndex;
            if (p.answerCharIndex >= sq.answer.length) {
              p.currentPhase = SubQStreamingPhase.COMPLETE;
            }
            if (p.answerCharIndex >= 10) {
              p.currentPhase = SubQStreamingPhase.COMPLETE;
            }
          } else {
            // no answer? just mark complete
            p.currentPhase = SubQStreamingPhase.COMPLETE;
          }
          break;
        }

        case SubQStreamingPhase.COMPLETE: {
          // Move on to the next subquestion
          activeSubQIndexRef.current++;
          break;
        }

        default:
          break;
      }

      // Commit changes
      dynamicSubQuestionsRef.current = [...dynamicSubQuestionsRef.current];
      setDynamicSubQuestions(dynamicSubQuestionsRef.current);

      // Timing: tweak as you prefer
      let delay = 25;
      if (p.currentPhase === SubQStreamingPhase.CONTEXT_DOCS) {
        delay = 200; // doc streaming can be slower
      } else if (p.currentPhase === SubQStreamingPhase.COMPLETE) {
        delay = 100; // small pause before we move to next subquestion
      }

      setTimeout(loadNextPiece, delay);
    }

    loadNextPiece();

    return () => {
      // Cleanup if needed (e.g., clearTimeout)
    };
  }, [subQuestions]);

  return { dynamicSubQuestions };
};
