"use client";

import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { MinimalOnyxDocument } from "@/lib/search/interfaces";
import { ChatFileType, FileDescriptor, Message } from "@/app/chat/interfaces";
import { DocumentPreview } from "@/app/chat/components/files/documents/DocumentPreview";
import { InMessageImage } from "@/app/chat/components/files/images/InMessageImage";
import "prismjs/themes/prism-tomorrow.css";
import ToolResult from "@/components/tools/ToolResult";
import CsvContent from "@/components/tools/CSVContent";
import "katex/dist/katex.min.css";
import { MessageSwitcher } from "@/app/chat/message/MessageSwitcher";
import Button from "@/components-2/buttons/Button";
import { useCurrentMessageTree } from "@/app/chat/stores/useChatSessionStore";
import { useChatController } from "@/app/chat/hooks/useChatController";
import { useDeepResearchToggle } from "@/app/chat/hooks/useDeepResearchToggle";
import { useAgentsContext } from "@/components-2/context/AgentsContext";
import { useChatContext } from "@/components-2/context/ChatContext";
import Text from "@/components-2/Text";
import { IconButton } from "@/components-2/buttons/IconButton";
import SvgCopy from "@/icons/copy";
import SvgEdit from "@/icons/edit";
import { cn } from "@/lib/utils";

interface FileDisplayProps {
  files: FileDescriptor[];
  alignBubble?: boolean;
  setPresentingDocument: (document: MinimalOnyxDocument) => void;
}

function FileDisplay({
  files,
  alignBubble,
  setPresentingDocument,
}: FileDisplayProps) {
  const [close, setClose] = useState(true);
  const imageFiles = files.filter((file) => file.type === ChatFileType.IMAGE);
  const textFiles = files.filter(
    (file) => file.type == ChatFileType.PLAIN_TEXT
  );

  const csvImgFiles = files.filter((file) => file.type == ChatFileType.CSV);

  return (
    <>
      {textFiles && textFiles.length > 0 && (
        <div
          id="onyx-file"
          className={` ${alignBubble && "ml-auto"} mt-2 auto mb-4`}
        >
          <div className="flex flex-col gap-2">
            {textFiles.map((file) => {
              return (
                <div key={file.id} className="w-fit">
                  <DocumentPreview
                    fileName={file.name || file.id}
                    alignBubble={alignBubble}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {imageFiles && imageFiles.length > 0 && (
        <div
          id="onyx-image"
          className={` ${alignBubble && "ml-auto"} mt-2 auto mb-4`}
        >
          <div className="flex flex-col gap-2">
            {imageFiles.map((file) => {
              return <InMessageImage key={file.id} fileId={file.id} />;
            })}
          </div>
        </div>
      )}
      {csvImgFiles && csvImgFiles.length > 0 && (
        <div className={` ${alignBubble && "ml-auto"} mt-2 auto mb-4`}>
          <div className="flex flex-col gap-2">
            {csvImgFiles.map((file) => {
              return (
                <div key={file.id} className="w-fit">
                  {close ? (
                    <>
                      <ToolResult
                        csvFileDescriptor={file}
                        close={() => setClose(false)}
                        contentComponent={CsvContent}
                      />
                    </>
                  ) : (
                    <DocumentPreview
                      open={() => setClose(true)}
                      fileName={file.name || file.id}
                      maxWidth="max-w-64"
                      alignBubble={alignBubble}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

interface EditingAreaProps {
  messageContent: string;
  setMessageContent: Dispatch<SetStateAction<string>>;
  close: () => void;
  messageId: number | null;
}

function EditingArea({
  messageContent,
  setMessageContent,
  close,
  messageId,
}: EditingAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [editedContent, setEditedContent] = useState(messageContent);
  const { currentChat } = useChatContext();
  const { currentAgent } = useAgentsContext();
  const { onSubmit } = useChatController();
  const { deepResearchEnabled } = useDeepResearchToggle({
    chatSessionId: currentChat?.id || null,
    assistantId: currentAgent?.id,
  });
  useEffect(() => {
    if (!textareaRef) return;
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  function submit() {
    if (!editedContent || editedContent === "" || !messageId) return;

    onSubmit({
      message: editedContent,
      messageIdToResend: messageId,
      selectedFiles: [],
      selectedFolders: [],
      currentMessageFiles: [],
      useAgentSearch: deepResearchEnabled,
    });
    setMessageContent(editedContent);
    close();
  }

  return (
    <div className="w-full flex flex-col border rounded-08 p-spacing-interline bg-background-tint-02">
      <textarea
        ref={textareaRef}
        className="w-full h-full overflow-y-hidden whitespace-normal break-word overscroll-contain resize-none overflow-y-auto bg-background-tint-02 outline-none p-padding-button"
        aria-multiline
        role="textarea"
        value={editedContent}
        style={{ scrollbarWidth: "thin" }}
        onChange={(event) => {
          setEditedContent(event.target.value);
          textareaRef.current!.style.height = "auto";
          event.target.style.height = `${event.target.scrollHeight}px`;
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
          // Submit edit if "Command Enter" is pressed, like in ChatGPT
          else if (event.key === "Enter" && event.metaKey) submit();
        }}
      />
      <div className="flex flex-row justify-end gap-spacing-inline">
        <Button onClick={submit}>Submit</Button>
        <Button secondary onClick={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface HumanMessageProps {
  message: Message;
  onMessageSelection: (messageId: number) => void;
}

function HumanMessageInner({ message, onMessageSelection }: HumanMessageProps) {
  const [messageContent, setMessageContent] = useState(message.message);
  const completeMessageTree = useCurrentMessageTree();
  const [hover, setHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { stopGenerating } = useChatController();

  const parentMessage = message.parentNodeId
    ? completeMessageTree?.get(message.parentNodeId)
    : null;
  const siblingMessageIds = parentMessage?.childrenNodeIds || [];
  const siblingMessagesIndex = message.messageId
    ? (siblingMessageIds || []).indexOf(message.messageId)
    : null;

  function handlePrevious() {
    // Return if the current message was:
    // - Does not have a messageId (possible for messages that have just been submitted).
    // - This message is the first message in the array.
    if (
      !siblingMessagesIndex ||
      siblingMessagesIndex === -1 ||
      siblingMessagesIndex === 0
    )
      return;
    stopGenerating();
    onMessageSelection(siblingMessageIds[siblingMessagesIndex - 1]!);
  }

  function handleNext() {
    // Return if the current message was:
    // - Does not have a messageId (possible for messages that have just been submitted).
    // - This message is the last message in the array.
    if (
      siblingMessagesIndex === null ||
      siblingMessagesIndex === -1 ||
      siblingMessagesIndex >= siblingMessageIds.length - 1
    )
      return;
    stopGenerating();
    onMessageSelection(siblingMessageIds[siblingMessagesIndex + 1]!);
  }

  return (
    <div className="flex flex-col justify-center items-end gap-spacing-inline">
      {isEditing ? (
        <EditingArea
          messageContent={messageContent}
          setMessageContent={setMessageContent}
          close={() => setIsEditing(false)}
          messageId={message.messageId || null}
        />
      ) : (
        <div
          className=" flex flex-col gap-spacing-inline items-end justify-center"
          onMouseLeave={() => setHovered(false)}
          onMouseEnter={() => setHovered(true)}
          onMouseOver={() => setHovered(true)}
        >
          <div className="flex flex-row items-center justify-end gap-spacing-inline">
            <div
              className={cn(
                "flex-row items-center h-full",
                hover ? "flex" : "hidden"
              )}
            >
              <IconButton icon={SvgCopy} tertiary tooltip="Copy" />
              <IconButton
                icon={SvgEdit}
                tertiary
                tooltip="Edit"
                onClick={() => setIsEditing(true)}
              />
            </div>
            <Text
              className={cn(
                "max-w-[25rem] w-fit p-padding-button rounded-t-16 rounded-bl-16 whitespace-break-spaces",
                hover ? "bg-background-tint-03" : "bg-background-tint-02"
              )}
            >
              {messageContent}
            </Text>
          </div>
          {siblingMessagesIndex !== null && siblingMessagesIndex !== -1 && (
            <div
              className={cn(hover ? "opacity-100" : "invisible cursor-auto")}
            >
              <MessageSwitcher
                currentPage={siblingMessagesIndex + 1}
                totalPages={siblingMessageIds.length}
                handlePrevious={handlePrevious}
                handleNext={handleNext}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const HumanMessage = React.memo(HumanMessageInner);
HumanMessage.displayName = "HumanMessage";

export default HumanMessage;
