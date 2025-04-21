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
    refreshIntervalInMs: undefined,
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
    refreshIntervalInMs: undefined,
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
    refreshIntervalInMs: undefined,
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
  console.log(totalQueryParts);
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
    refreshIntervalInMs: undefined,
  });

  return {
    filteredAssistants,
    isLoadingFilteredAssistants,
    currentFilteredPage,
    totalFilteredPages,
    goToFilteredPage,
  };
};

export const usePrefetchedAdminAssistants = (editable: boolean) => {
  const {
    currentPageData: adminAssistants,
    isLoading: isLoadingAdminAssistants,
    currentPage: currentAdminPage,
    totalPages: totalAdminPages,
    goToPage: goToAdminPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: `/api/admin/persona${editable ? "?get_editable=true" : ""}`,
    refreshIntervalInMs: undefined,
  });

  return {
    adminAssistants,
    isLoadingAdminAssistants,
    currentAdminPage,
    totalAdminPages,
    goToAdminPage,
  };
};

export const usePrefetchedFilteredAssistants = (
  hasAnyConnectors: boolean,
  hasImageCompatibleModel: boolean
) => {
  const {
    currentPageData: filteredAssistants,
    isLoading: isLoadingFilteredAssistants,
    currentPage: currentFilteredPage,
    totalPages: totalFilteredPages,
    goToPage: goToFilteredPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: `/api/persona?has_any_connectors=${hasAnyConnectors}&has_image_compatible_model=${hasImageCompatibleModel}`,
    refreshIntervalInMs: undefined,
  });

  return {
    filteredAssistants,
    isLoadingFilteredAssistants,
    currentFilteredPage,
    totalFilteredPages,
    goToFilteredPage,
  };
};

export const usePrefetchedAllAssistants = () => {
  const {
    currentPageData: allAssistants,
    isLoading: isLoadingAllAssistants,
    currentPage: currentAllPage,
    totalPages: totalAllPages,
    goToPage: goToAllPage,
  } = usePaginatedFetch<Persona>({
    itemsPerPage: ITEMS_PER_PAGE,
    pagesPerBatch: PAGES_PER_BATCH,
    endpoint: "/api/persona",
    refreshIntervalInMs: undefined,
  });

  return {
    allAssistants,
    isLoadingAllAssistants,
    currentAllPage,
    totalAllPages,
    goToAllPage,
  };
};
