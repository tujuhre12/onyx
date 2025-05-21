import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { ChatSession } from "../interfaces";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { ChatSessionDisplay } from "./ChatSessionDisplay";
import { useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";

export default function ChatGroup({
  name,
  chatSessions,
  expanded,
  toggleExpanded,
  selectedId,
  editable,
}: {
  name: string;
  chatSessions: ChatSession[];
  expanded: boolean;
  toggleExpanded: () => void;
  selectedId: string | undefined;
  editable: boolean;
}) {
  const hasChatsToShow = chatSessions.length > 0;
  const [hover, setHover] = useState(false);

  return (
    <SidebarMenu>
      <Collapsible
        className="group/collapsible"
        open={hasChatsToShow && expanded}
      >
        <CollapsibleTrigger
          asChild
          onClick={toggleExpanded}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <SidebarMenuButton tooltip={name} className="flex flex-row">
            <span className="flex flex-1">{name}</span>
            {editable && hover && <FiMoreHorizontal size={16} />}
            <ChevronRight
              className={`ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 ${
                hasChatsToShow ? "" : "text-neutral-700"
              }`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarMenuSub>
            {chatSessions.map((chatSession) => (
              <SidebarMenuSubItem key={chatSession.name}>
                <SidebarMenuSubButton asChild>
                  <ChatSessionDisplay
                    chatSession={chatSession}
                    isSelected={selectedId === chatSession.id}
                    // showShareModal={showShareModal}
                    // showDeleteModal={showDeleteModal}
                    // closeSidebar={closeSidebar}
                    // isDragging={isDraggingSessionId === chat.id}
                  />
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenu>
  );
}
