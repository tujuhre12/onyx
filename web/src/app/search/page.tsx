import { DocumentsProvider } from "@/app/chat/my-documents/DocumentsContext";
import { SEARCH_PARAMS } from "@/lib/extension/constants";

export default async function Page(props: {
  searchParams: Promise<{ [key: string]: string }>;
}) {
  const searchParams = await props.searchParams;
  const firstMessage = searchParams.firstMessage;
  const defaultSidebarOff =
    searchParams[SEARCH_PARAMS.DEFAULT_SIDEBAR_OFF] === "true";

  return (
    <DocumentsProvider>
      <></>
    </DocumentsProvider>
  );
}
