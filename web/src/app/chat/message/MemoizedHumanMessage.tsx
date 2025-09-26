import React, { useCallback } from "react";
import { MinimalOnyxDocument } from "@/lib/search/interfaces";
import { FileDescriptor, Message } from "@/app/chat/interfaces";
import { HumanMessage } from "../../../components-2/messages/HumanMessage";

interface BaseMemoizedHumanMessageProps {
  message: Message;
  content: string;
  files?: FileDescriptor[];
  messageId?: number | null;
  otherMessagesCanSwitchTo?: number[];
  onMessageSelection?: (messageId: number) => void;
  shared?: boolean;
  stopGenerating?: () => void;
  disableSwitchingForStreaming?: boolean;
  setPresentingDocument: (document: MinimalOnyxDocument) => void;
}

interface InternalMemoizedHumanMessageProps
  extends BaseMemoizedHumanMessageProps {
  onEdit: (editedContent: string) => void;
}

interface MemoizedHumanMessageProps extends BaseMemoizedHumanMessageProps {
  handleEditWithMessageId: (
    editedContent: string,
    messageId: number | null | undefined
  ) => void;
}

const _MemoizedHumanMessage = React.memo(function _MemoizedHumanMessage({
  message,
  content,
  files,
  messageId,
  otherMessagesCanSwitchTo,
  onMessageSelection,
  shared,
  stopGenerating,
  disableSwitchingForStreaming,
  setPresentingDocument,
  onEdit,
}: InternalMemoizedHumanMessageProps) {
  return (
    <HumanMessage
      message={message}
      content={content}
      files={files}
      messageId={messageId ?? undefined}
      otherMessagesCanSwitchTo={otherMessagesCanSwitchTo}
      onMessageSelection={onMessageSelection}
      shared={shared}
      stopGenerating={stopGenerating}
      disableSwitchingForStreaming={disableSwitchingForStreaming}
      setPresentingDocument={setPresentingDocument}
      onEdit={onEdit}
    />
  );
});

export const MemoizedHumanMessage = ({
  message,
  content,
  files,
  messageId,
  otherMessagesCanSwitchTo,
  onMessageSelection,
  shared,
  stopGenerating,
  disableSwitchingForStreaming,
  setPresentingDocument,
  handleEditWithMessageId,
}: MemoizedHumanMessageProps) => {
  const onEdit = useCallback(
    (editedContent: string) => {
      handleEditWithMessageId(editedContent, messageId ?? undefined);
    },
    [handleEditWithMessageId, messageId]
  );

  return (
    <_MemoizedHumanMessage
      message={message}
      content={content}
      files={files}
      messageId={messageId}
      otherMessagesCanSwitchTo={otherMessagesCanSwitchTo}
      onMessageSelection={onMessageSelection}
      shared={shared}
      stopGenerating={stopGenerating}
      disableSwitchingForStreaming={disableSwitchingForStreaming}
      setPresentingDocument={setPresentingDocument}
      onEdit={onEdit}
    />
  );
};
