import { MinimalOnyxDocument, OnyxDocument } from "@/lib/search/interfaces";
import { ChatDocumentDisplay } from "./ChatDocumentDisplay";
import { removeDuplicateDocs } from "@/lib/documentUtils";
import { ChatFileType, Message } from "@/app/chat/interfaces";
import {
  Dispatch,
  ForwardedRef,
  forwardRef,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import { XIcon } from "@/components/icons/icons";
import { FileSourceCardInResults } from "@/app/chat/message/SourcesDisplay";
import { useDocumentsContext } from "@/app/chat/my-documents/DocumentsContext";
import { CitationMap } from "@/app/chat/interfaces";

interface DocumentResultsProps {
  agenticMessage: boolean;
  humanMessage: Message | null;
  closeSidebar: () => void;
  selectedMessage: Message | null;
  selectedDocuments: OnyxDocument[] | null;
  toggleDocumentSelection: (document: OnyxDocument) => void;
  clearSelectedDocuments: () => void;
  selectedDocumentTokens: number;
  maxTokens: number;
  initialWidth: number;
  isOpen: boolean;
  isSharedChat?: boolean;
  modal: boolean;
  setPresentingDocument: Dispatch<SetStateAction<MinimalOnyxDocument | null>>;
  removeHeader?: boolean;
  citations?: CitationMap | null;
}

export const DocumentResults = forwardRef<HTMLDivElement, DocumentResultsProps>(
  (
    {
      agenticMessage,
      humanMessage,
      closeSidebar,
      modal,
      selectedMessage,
      selectedDocuments,
      toggleDocumentSelection,
      clearSelectedDocuments,
      selectedDocumentTokens,
      maxTokens,
      initialWidth,
      isSharedChat,
      isOpen,
      setPresentingDocument,
      removeHeader,
      citations,
    },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    const { files: allUserFiles } = useDocumentsContext();

    const humanFileDescriptors = humanMessage?.files.filter(
      (file) => file.type == ChatFileType.USER_KNOWLEDGE
    );
    const userFiles = allUserFiles?.filter((file) =>
      humanFileDescriptors?.some((descriptor) => descriptor.id === file.file_id)
    );
    const selectedDocumentIds =
      selectedDocuments?.map((document) => document.document_id) || [];

    const currentDocuments = selectedMessage?.documents || null;
    const dedupedDocuments = removeDuplicateDocs(currentDocuments || []);

    const tokenLimitReached = selectedDocumentTokens > maxTokens - 75;

    // Separate cited documents from other documents
    const citedDocumentIds = new Set<number>();
    if (citations) {
      Object.values(citations).forEach((docDbId) => {
        citedDocumentIds.add(docDbId as number);
      });
    }

    const citedDocuments = dedupedDocuments.filter(
      (doc) =>
        doc.db_doc_id !== null &&
        doc.db_doc_id !== undefined &&
        citedDocumentIds.has(doc.db_doc_id)
    );
    const otherDocuments = dedupedDocuments.filter(
      (doc) =>
        doc.db_doc_id === null ||
        doc.db_doc_id === undefined ||
        !citedDocumentIds.has(doc.db_doc_id)
    );

    return (
      <>
        <div
          id="onyx-chat-sidebar"
          className={`relative -mb-8 bg-background max-w-full ${
            !modal
              ? "border-l border-t h-[105vh]  border-sidebar-border dark:border-neutral-700"
              : ""
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeSidebar();
            }
          }}
        >
          <div
            className={`ml-auto h-full relative sidebar transition-transform ease-in-out duration-300 
            ${isOpen ? " translate-x-0" : " translate-x-[10%]"}`}
            style={{
              width: modal ? undefined : initialWidth,
            }}
          >
            <div className="flex flex-col h-full">
              {!removeHeader && (
                <>
                  <div className="p-4 flex items-center justify-between gap-x-2">
                    <div className="flex items-center gap-x-2">
                      <h2 className="text-xl font-bold text-text-900">
                        Sources
                      </h2>
                    </div>
                    <button className="my-auto" onClick={closeSidebar}>
                      <XIcon size={16} />
                    </button>
                  </div>
                  <div className="border-b border-divider-history-sidebar-bar mx-3" />
                </>
              )}

              <div className="overflow-y-auto h-fit mb-8 pb-8 sm:mx-0 flex-grow gap-y-0 default-scrollbar dark-scrollbar flex flex-col">
                {userFiles && userFiles.length > 0 ? (
                  <div className=" gap-y-2 flex flex-col pt-2 mx-3">
                    {userFiles?.map((file, index) => (
                      <FileSourceCardInResults
                        key={index}
                        relevantDocument={dedupedDocuments.find(
                          (doc) =>
                            doc.document_id ===
                            `FILE_CONNECTOR__${file.file_id}`
                        )}
                        document={file}
                        setPresentingDocument={() =>
                          setPresentingDocument({
                            document_id: file.document_id,
                            semantic_identifier: file.file_id || null,
                          })
                        }
                      />
                    ))}
                  </div>
                ) : dedupedDocuments.length > 0 ? (
                  <>
                    {/* Cited Documents Section */}
                    {citedDocuments.length > 0 && (
                      <div className="mt-2">
                        <div className="px-4 pb-2">
                          <h3 className="text-sm font-semibold text-text-700">
                            Cited Documents
                          </h3>
                        </div>
                        {citedDocuments.map((document, ind) => (
                          <div
                            key={document.document_id}
                            className={`desktop:px-2 w-full`}
                          >
                            <ChatDocumentDisplay
                              agenticMessage={agenticMessage}
                              setPresentingDocument={setPresentingDocument}
                              closeSidebar={closeSidebar}
                              modal={modal}
                              document={document}
                              isSelected={selectedDocumentIds.includes(
                                document.document_id
                              )}
                              handleSelect={(documentId) => {
                                toggleDocumentSelection(
                                  dedupedDocuments.find(
                                    (doc) => doc.document_id === documentId
                                  )!
                                );
                              }}
                              hideSelection={isSharedChat}
                              tokenLimitReached={tokenLimitReached}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Other Documents Section */}
                    {otherDocuments.length > 0 && (
                      <div
                        className={citedDocuments.length > 0 ? "mt-4" : "mt-2"}
                      >
                        {citedDocuments.length > 0 && (
                          <>
                            <div className="px-4 pb-2">
                              <h3 className="text-sm font-semibold text-text-700">
                                Other Documents
                              </h3>
                            </div>
                          </>
                        )}
                        {otherDocuments.map((document, ind) => (
                          <div
                            key={document.document_id}
                            className={`desktop:px-2 w-full`}
                          >
                            <ChatDocumentDisplay
                              agenticMessage={agenticMessage}
                              setPresentingDocument={setPresentingDocument}
                              closeSidebar={closeSidebar}
                              modal={modal}
                              document={document}
                              isSelected={selectedDocumentIds.includes(
                                document.document_id
                              )}
                              handleSelect={(documentId) => {
                                toggleDocumentSelection(
                                  dedupedDocuments.find(
                                    (doc) => doc.document_id === documentId
                                  )!
                                );
                              }}
                              hideSelection={isSharedChat}
                              tokenLimitReached={tokenLimitReached}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }
);

DocumentResults.displayName = "DocumentResults";
