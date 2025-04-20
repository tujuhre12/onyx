import { Persona } from "@/app/admin/assistants/interfaces";
import usePaginatedFetch from "../usePaginatedFetch";
import { AssistantFilter } from "@/app/assistants/mine/AssistantModal";

const ITEMS_PER_PAGE = 100;
const PAGES_PER_BATCH = 1;
const AssistantFilterName = {
  Pinned: "is_pinned=true",
  Public: "is_public=true",
  Private: "is_public=false",
  Mine: "is_users=true",
};

export const usePrefetchedPublicAssistants = () => {
  const {
    currentPageData: publicAssistants,
    isLoading: isLoadingPublicAssistants,
    currentPage: currentPublicPage,
    totalPages: totalPublicPages,
    goToPage: goToPublicPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: "/api/persona?is_public=true",
  });

  return {
    publicAssistants,
    isLoadingPublicAssistants,
    currentPublicPage,
    totalPublicPages,
    goToPublicPage,
  };
};

export const usePrefetchedPrivateAssistants = () => {
  const {
    currentPageData: privateAssistants,
    isLoading: isLoadingPrivateAssistants,
    currentPage: currentPrivatePage,
    totalPages: totalPrivatePages,
    goToPage: goToPrivatePage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: "/api/persona?is_public=false",
  });

  return {
    privateAssistants,
    isLoadingPrivateAssistants,
    currentPrivatePage,
    totalPrivatePages,
    goToPrivatePage,
  };
};

export const usePrefetchedPinnedAssistants = () => {
  const {
    currentPageData: pinnedAssistants,
    isLoading: isLoadingPinnedAssistants,
    currentPage: currentPinnedPage,
    totalPages: totalPinnedPages,
    goToPage: goToPinnedPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: "/api/persona?is_pinned=true",
  });

  return {
    pinnedAssistants,
    isLoadingPinnedAssistants,
    currentPinnedPage,
    totalPinnedPages,
    goToPinnedPage,
  };
};

export const usePrefetchedUsersAssistants = () => {
  const {
    currentPageData: usersAssistants,
    isLoading: isLoadingUsersAssistants,
    currentPage: currentUsersPage,
    totalPages: totalUsersPages,
    goToPage: goToUsersPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: "/api/persona?is_users=true",
  });

  return {
    usersAssistants,
    isLoadingUsersAssistants,
    currentUsersPage,
    totalUsersPages,
    goToUsersPage,
  };
};

export const useFilteredAssistants = (
  assistantFilters: AssistantFilter[],
  searchQuery: string
) => {
  const totalQueryParts = [];
  assistantFilters.forEach((filter) => {
    totalQueryParts.push(AssistantFilterName[filter]);
  });
  if (searchQuery.length > 0) {
    totalQueryParts.push(`name_matches=${searchQuery}`);
  }
  const totalQuery = totalQueryParts.join("&");
  const {
    currentPageData: filteredAssistants,
    isLoading: isLoadingFilteredAssistants,
    currentPage: currentFilteredPage,
    totalPages: totalFilteredPages,
    goToPage: goToFilteredPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: `/api/persona?${totalQuery}`,
  });

  return {
    filteredAssistants,
    isLoadingFilteredAssistants,
    currentFilteredPage,
    totalFilteredPages,
    goToFilteredPage,
  };
};
