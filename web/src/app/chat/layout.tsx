import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { cookies } from "next/headers";
import { fetchChatData } from "@/lib/chat/fetchChatData";
import { ChatProvider } from "@/components/context/ChatContext";
import { InstantSSRAutoRefresh } from "@/components/SSRAutoRefresh";

export default async function Layout({
  children,
}: //   searchParams,
{
  children: React.ReactNode;
  //   searchParams: { [key: string]: string | string[] | undefined };
}) {
  noStore();
  const requestCookies = cookies();

  // Ensure searchParams is an object, even if it's empty
  const safeSearchParams = {};

  const data = await fetchChatData(
    safeSearchParams as { [key: string]: string }
  );
  //   const defaultSidebarOff = safeSearchParams.defaultSidebarOff === "true";

  if ("redirect" in data) {
    redirect(data.redirect);
  }

  const {
    user,
    chatSessions,
    availableSources,
    documentSets,
    tags,
    llmProviders,
    folders,
    toggleSidebar,
    openedFolders,
    defaultAssistantId,
    shouldShowWelcomeModal,
    ccPairs,
  } = data;

  return (
    <>
      <InstantSSRAutoRefresh />
      {/* {shouldShowWelcomeModal && (
        <WelcomeModal user={user} requestCookies={requestCookies} />
      )} */}
      <ChatProvider
        value={{
          chatSessions,
          availableSources,
          ccPairs,
          documentSets,
          tags,
          availableDocumentSets: documentSets,
          availableTags: tags,
          llmProviders,
          folders,
          openedFolders,
          shouldShowWelcomeModal,
          defaultAssistantId,
        }}
      >
        {children}
      </ChatProvider>
    </>
  );
}
