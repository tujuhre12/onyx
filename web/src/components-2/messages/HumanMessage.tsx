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
import { useAgentsContext } from "../context/AgentsContext";
import { useChatContext } from "../context/ChatContext";
import Text from "../Text";
import { IconButton } from "../buttons/IconButton";
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

export function HumanMessage({
  message,
  onMessageSelection,
}: HumanMessageProps) {
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
    : 0;

  const getPreviousMessage = () => {
    if (
      siblingMessagesIndex !== undefined &&
      siblingMessagesIndex > 0 &&
      siblingMessageIds
    ) {
      return siblingMessageIds[siblingMessagesIndex - 1];
    }
    return undefined;
  };

  const getNextMessage = () => {
    if (
      siblingMessagesIndex !== undefined &&
      siblingMessagesIndex < (siblingMessageIds?.length || 0) - 1 &&
      siblingMessageIds
    ) {
      return siblingMessageIds[siblingMessagesIndex + 1];
    }
    return undefined;
  };

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
            <div
              onMouseEnter={() => setHovered(true)}
              onMouseOver={() => setHovered(true)}
            >
              <Text
                className={cn(
                  "max-w-[25rem] w-fit p-padding-button rounded-t-16 rounded-bl-16 whitespace-break-spaces",
                  hover ? "bg-background-tint-03" : "bg-background-tint-02"
                )}
              >
                {messageContent}
              </Text>
            </div>
          </div>
          <div className={cn(hover ? "opacity-100" : "invisible cursor-auto")}>
            <MessageSwitcher
              currentPage={siblingMessagesIndex + 1}
              totalPages={siblingMessageIds.length}
              handlePrevious={() => {
                stopGenerating();
                const previousMessage = getPreviousMessage();
                if (!previousMessage) return;
                onMessageSelection(previousMessage);
              }}
              handleNext={() => {
                stopGenerating();
                const nextMessage = getNextMessage();
                if (!nextMessage) return;
                onMessageSelection(nextMessage);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  // const textareaRef = useRef<HTMLTextAreaElement>(null);
  // const [isHovered, setIsHovered] = useState(false);
  // const [isEditing, setIsEditing] = useState(false);
  // const [editedContent, setEditedContent] = useState(content);
  // useEffect(() => setEditedContent(content), [content]);
  // useEffect(() => {
  //   if (textareaRef.current) {
  //     // Focus the textarea
  //     textareaRef.current.focus();
  //     // Move the cursor to the end of the text
  //     textareaRef.current.selectionStart = textareaRef.current.value.length;
  //     textareaRef.current.selectionEnd = textareaRef.current.value.length;
  //     textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  //   }
  // }, [isEditing]);

  // const handleEditSubmit = () => {
  //   onEdit?.(editedContent);
  //   setIsEditing(false);
  // };

  // const currentMessageInd = messageId
  //   ? otherMessagesCanSwitchTo?.indexOf(messageId)
  //   : undefined;

  // return (
  //   <div
  //     id="onyx-human-message"
  //     className="pt-5 pb-1 w-full lg:px-5 flex -mr-6 relative"
  //     onMouseEnter={() => setIsHovered(true)}
  //     onMouseLeave={() => setIsHovered(false)}
  //   >
  //     <div className={`mx-auto ${shared ? "w-full" : "w-[90%]"} max-w-[790px]`}>
  //       <div className="xl:ml-8">
  //         <div className="flex flex-col desktop:mr-4">
  //           <FileDisplay
  //             alignBubble
  //             setPresentingDocument={setPresentingDocument}
  //             files={files || []}
  //           />

  //           <div className="flex justify-end">
  //             <div className="w-full ml-8 flex w-full w-[800px] break-words">
  //               {isEditing ? (
  //                 <EditingArea
  //                   textareaRef={textareaRef}
  //                   editedContent={editedContent}
  //                   setEditedContent={setEditedContent}
  //                   onSubmit={handleEditSubmit}
  //                   onCancel={() => setIsEditing(false)}
  //                   originalContent={content}
  //                 />
  //               ) : typeof content === "string" ? (
  //                 <>
  //                   <div className="ml-auto flex items-center mr-1 mt-2 h-fit mb-auto">
  //                     {onEdit &&
  //                     isHovered &&
  //                     !isEditing &&
  //                     (!files || files.length === 0) ? (
  //                       <TooltipProvider>
  //                         <Tooltip>
  //                           <TooltipTrigger>
  //                             <HoverableIcon
  //                               icon={<FiEdit2 className="text-text-05" />}
  //                               onClick={() => {
  //                                 setIsEditing(true);
  //                                 setIsHovered(false);
  //                               }}
  //                             />
  //                           </TooltipTrigger>
  //                           <TooltipContent>Edit</TooltipContent>
  //                         </Tooltip>
  //                       </TooltipProvider>
  //                     ) : (
  //                       <div className="w-7" />
  //                     )}
  //                   </div>

  //                   <div
  //                     className={`${
  //                       !(
  //                         onEdit &&
  //                         isHovered &&
  //                         !isEditing &&
  //                         (!files || files.length === 0)
  //                       ) && "ml-auto"
  //                     } relative flex-none max-w-[70%] mb-auto whitespace-break-spaces rounded-bl-3xl rounded-t-3xl bg-background-neutral-02 px-5 py-2.5`}
  //                   >
  //                     {editedContent}
  //                   </div>
  //                 </>
  //               ) : (
  //                 <>
  //                   {onEdit &&
  //                   isHovered &&
  //                   !isEditing &&
  //                   (!files || files.length === 0) ? (
  //                     <div className="my-auto">
  //                       <Hoverable
  //                         icon={FiEdit2}
  //                         onClick={() => {
  //                           setIsEditing(true);
  //                           setIsHovered(false);
  //                         }}
  //                       />
  //                     </div>
  //                   ) : (
  //                     <div className="h-[27px]" />
  //                   )}
  //                   <div className="ml-auto rounded-lg p-1">
  //                     {editedContent}
  //                   </div>
  //                 </>
  //               )}
  //             </div>
  //           </div>
  //         </div>

  //         <div className="flex flex-col md:flex-row gap-x-0.5 mt-1">
  //           {currentMessageInd !== undefined &&
  //             onMessageSelection &&
  //             otherMessagesCanSwitchTo &&
  //             otherMessagesCanSwitchTo.length > 1 && (
  //               <div className="ml-auto mr-3">
  //                 <MessageSwitcher
  //                   disableForStreaming={disableSwitchingForStreaming}
  //                   currentPage={currentMessageInd + 1}
  //                   totalPages={otherMessagesCanSwitchTo.length}
  //                   handlePrevious={() => {
  //                     stopGenerating();
  //                     const prevMessage = getPreviousMessage();
  //                     if (prevMessage !== undefined) {
  //                       onMessageSelection(prevMessage);
  //                     }
  //                   }}
  //                   handleNext={() => {
  //                     stopGenerating();
  //                     const nextMessage = getNextMessage();
  //                     if (nextMessage !== undefined) {
  //                       onMessageSelection(nextMessage);
  //                     }
  //                   }}
  //                 />
  //               </div>
  //             )}
  //         </div>
  //       </div>
  //     </div>
  //   </div>
  // );
}
