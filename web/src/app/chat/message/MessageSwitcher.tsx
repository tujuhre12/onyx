import { IconButton } from "@/components-2/buttons/IconButton";
import Text from "@/components-2/Text";
import SvgChevronLeft from "@/icons/chevron-left";
import SvgChevronRight from "@/icons/chevron-right";

interface MessageSwitcherProps {
  currentPage: number;
  totalPages: number;
  handlePrevious: () => void;
  handleNext: () => void;
}

export function MessageSwitcher({
  currentPage,
  totalPages,
  handlePrevious,
  handleNext,
}: MessageSwitcherProps) {
  return (
    <div className="flex flex-row items-center gap-spacing-inline">
      <IconButton
        icon={SvgChevronLeft}
        disabled={currentPage === 1}
        internal
        onClick={handlePrevious}
      />
      <div className="flex flex-row items-center gap-spacing-inline">
        <Text mainAction text03>
          {currentPage}
        </Text>
        <div />
        <Text mainAction text03>
          /
        </Text>
        <Text mainAction text03>
          {totalPages}
        </Text>
      </div>

      <IconButton
        icon={SvgChevronRight}
        disabled={currentPage === totalPages}
        internal
        onClick={handleNext}
      />
    </div>
  );
}
