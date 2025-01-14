"use client";

import SidebarWrapper from "@/app/assistants/SidebarWrapper";
import InputPrompts from "./InputPrompts";
import { BackButton } from "@/components/BackButton";
import { useChatContext } from "@/components/context/ChatContext";

export default function InputPromptsPage() {
  const { toggledSidebar } = useChatContext();
  return (
    <SidebarWrapper initiallyToggled={toggledSidebar}>
      <InputPrompts />
    </SidebarWrapper>
  );
}
