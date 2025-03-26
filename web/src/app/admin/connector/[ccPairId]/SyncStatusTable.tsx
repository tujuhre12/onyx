import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CCPairFullInfo } from "./types";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface SyncRecord {
  id: number;
  entity_id: number;
  sync_type: string;
  created_at: string;
}

interface SyncStatusTableProps {
  ccPair: CCPairFullInfo;
  syncRecords: SyncRecord[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function SyncStatusTable({
  ccPair,
  syncRecords,
  currentPage,
  totalPages,
  onPageChange,
}: SyncStatusTableProps) {
  const hasPagination = totalPages > 1;

  return (
    <div className="mb-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {syncRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-4">
                No sync records found
              </TableCell>
            </TableRow>
          ) : (
            syncRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">{record.id}</TableCell>
                <TableCell>{record.sync_type}</TableCell>
                <TableCell>
                  {formatDateTime(new Date(record.created_at))}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasPagination && (
        <div className="flex items-center justify-end mt-4 space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
