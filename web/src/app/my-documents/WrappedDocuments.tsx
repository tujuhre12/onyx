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
      <div className="mx-auto w-searchbar-xs 2xl:w-searchbar-sm 3xl:w-searchbar">
        <Title>My Documents</Title>
        <MyDocuments />
      </div>
    </SidebarWrapper>
  );
}
