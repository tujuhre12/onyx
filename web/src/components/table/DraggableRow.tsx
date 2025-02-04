import { useSortable } from "@dnd-kit/sortable";
import { TableCell, TableRow } from "@/components/ui/table";
import { CSS } from "@dnd-kit/utilities";
import { DragHandle } from "./DragHandle";
import { Row } from "./interfaces";

export function DraggableRow({
  row,
  isAdmin = true,
}: {
  row: Row;
  isAdmin?: boolean;
}) {
  const {
    attributes,
    listeners,
    transform,
    transition,
    setNodeRef,
    isDragging,
  } = useSortable({
    id: row.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50" : ""}
    >
      <TableCell>
        {isAdmin && (
          <DragHandle isDragging={isDragging} {...attributes} {...listeners} />
        )}
      </TableCell>
      {row.cells.map((cell, index) => (
        <TableCell key={index}>{cell}</TableCell>
      ))}
    </TableRow>
  );
}
