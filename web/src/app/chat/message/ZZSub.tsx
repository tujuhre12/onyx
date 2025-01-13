import React from "react";
import { SubQuestionDetail } from "../interfaces";
import { OnyxDocument } from "@/lib/search/interfaces";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableRow,
} from "@/components/ui/table";
interface SubQuestionProgressProps {
  subQuestions: SubQuestionDetail[];
}

const SubQuestionProgress: React.FC<SubQuestionProgressProps> = ({
  subQuestions,
}) => {
  return (
    <div className="sub-question-progress space-y-4">
      <Table>
        <TableBody>
          {subQuestions.map((sq, index) => (
            <TableRow key={index}>
              <TableCell>
                Level {sq.level}, Q{sq.level_question_nr}
              </TableCell>
              <TableCell>
                {sq.question ? "Generated" : "Not generated"}
              </TableCell>
              <TableCell>{sq.answer ? "Answered" : "Not answered"}</TableCell>
              <TableCell>
                {sq.sub_queries
                  ? `${sq.sub_queries.length} sub-queries`
                  : "No sub-queries"}
              </TableCell>
              <TableCell>
                {sq.context_docs
                  ? `${sq.context_docs.top_documents.length} docs`
                  : "No docs"}
              </TableCell>
              <TableCell>
                {sq.is_generating ? "Generating..." : "Complete"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SubQuestionProgress;
