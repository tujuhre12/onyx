"use client";

import Title from "@/components/ui/title";
import SidebarWrapper from "../assistants/SidebarWrapper";
import MyDocuments from "./MyDocuments";

export default function WrappedUserDocuments({
  initiallyToggled,
}: {
  initiallyToggled: boolean;
}) {
  return (
    <SidebarWrapper size="lg" initiallyToggled={initiallyToggled}>
      <div className="mx-auto  max-w-4xl w-full">
        <MyDocuments />
      </div>
    </SidebarWrapper>
  );
}
