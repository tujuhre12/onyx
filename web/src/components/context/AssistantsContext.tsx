"use client";
import React, {
  createContext,
  useState,
  useContext,
  useMemo,
  useEffect,
  SetStateAction,
  Dispatch,
} from "react";
import { Persona } from "@/app/admin/assistants/interfaces";
import {
  classifyAssistants,
  orderAssistantsForUser,
  getUserCreatedAssistants,
  filterAssistants,
} from "@/lib/assistants/utils";
import { useUser } from "../user/UserProvider";
import usePaginatedFetch from "@/hooks/usePaginatedFetch";

interface AssistantsContextProps {
  assistants: Persona[];
  visibleAssistants: Persona[];
  hiddenAssistants: Persona[];
  finalAssistants: Persona[];
  ownedButHiddenAssistants: Persona[];
  refreshAssistants: () => Promise<void>;
  isImageGenerationAvailable: boolean;
  // Admin only
  editablePersonas: Persona[];
  allAssistants: Persona[];
  pinnedAssistants: Persona[];
  setPinnedAssistants: Dispatch<SetStateAction<Persona[]>>;
  isLoadingEditablePersonas: boolean;
  currentEditablePage: number;
  totalEditablePages: number;
  goToEditablePage: (page: number) => void;
  isLoadingAllPersonas: boolean;
  currentAllPage: number;
  totalAllPages: number;
  goToAllPage: (page: number) => void;
}

const AssistantsContext = createContext<AssistantsContextProps | undefined>(
  undefined
);

const ITEMS_PER_PAGE = 100;
const PAGES_PER_BATCH = 1;

export const AssistantsProvider: React.FC<{
  children: React.ReactNode;
  initialAssistants: Persona[];
  hasAnyConnectors: boolean;
  hasImageCompatibleModel: boolean;
}> = ({
  children,
  initialAssistants,
  hasAnyConnectors,
  hasImageCompatibleModel,
}) => {
  const [assistants, setAssistants] = useState<Persona[]>(
    initialAssistants || []
  );
  const { user, isAdmin, isCurator } = useUser();
  const [editablePersonas, setEditablePersonas] = useState<Persona[]>([]);
  const [allAssistants, setAllAssistants] = useState<Persona[]>([]);
  const [isLoadingEditablePersonas, setIsLoadingEditablePersonas] =
    useState<boolean>(false);
  const [currentEditablePage, setCurrentEditablePage] = useState<number>(1);
  const [totalEditablePages, setTotalEditablePages] = useState<number>(1);
  const [goToEditablePage, setGoToEditablePage] = useState<
    (page: number) => void
  >(() => {});
  const [isLoadingAllPersonas, setIsLoadingAllPersonas] =
    useState<boolean>(false);
  const [currentAllPage, setCurrentAllPage] = useState<number>(1);
  const [totalAllPages, setTotalAllPages] = useState<number>(1);
  const [goToAllPage, setGoToAllPage] = useState<(page: number) => void>(
    () => {}
  );
  const [pinnedAssistants, setPinnedAssistants] = useState<Persona[]>(() => {
    if (user?.preferences.pinned_assistants) {
      return user.preferences.pinned_assistants
        .map((id) => assistants.find((assistant) => assistant.id === id))
        .filter((assistant): assistant is Persona => assistant !== undefined);
    } else {
      return assistants.filter((a) => a.is_default_persona);
    }
  });

  useEffect(() => {
    setPinnedAssistants(() => {
      if (user?.preferences.pinned_assistants) {
        return user.preferences.pinned_assistants
          .map((id) => assistants.find((assistant) => assistant.id === id))
          .filter((assistant): assistant is Persona => assistant !== undefined);
      } else {
        return assistants.filter((a) => a.is_default_persona);
      }
    });
  }, [user?.preferences?.pinned_assistants, assistants]);

  const [isImageGenerationAvailable, setIsImageGenerationAvailable] =
    useState<boolean>(false);

  useEffect(() => {
    const checkImageGenerationAvailability = async () => {
      try {
        const response = await fetch("/api/persona/image-generation-tool");
        if (response.ok) {
          const { is_available } = await response.json();
          setIsImageGenerationAvailable(is_available);
        }
      } catch (error) {
        console.error("Error checking image generation availability:", error);
      }
    };

    checkImageGenerationAvailability();
  }, []);

  const fetchPersonas = async () => {
    if (!isAdmin && !isCurator) {
      return;
    }

    try {
      const {
        currentPageData: editablePersonas,
        isLoading: isLoadingEditablePersonas,
        currentPage: currentEditablePage,
        totalPages: totalEditablePages,
        goToPage: goToEditablePage,
      } = usePaginatedFetch<Persona>({
        itemsPerPage: ITEMS_PER_PAGE,
        pagesPerBatch: PAGES_PER_BATCH,
        endpoint: "/api/admin/persona?get_editable=true",
      });

      const {
        currentPageData: allPersonas,
        isLoading: isLoadingAllPersonas,
        currentPage: currentAllPage,
        totalPages: totalAllPages,
        goToPage: goToAllPage,
      } = usePaginatedFetch<Persona>({
        itemsPerPage: ITEMS_PER_PAGE,
        pagesPerBatch: PAGES_PER_BATCH,
        endpoint: "/api/admin/persona",
      });

      if (editablePersonas) {
        setEditablePersonas(editablePersonas);
        setIsLoadingEditablePersonas(isLoadingEditablePersonas);
        setCurrentEditablePage(currentEditablePage);
        setTotalEditablePages(totalEditablePages);
        setGoToEditablePage(goToEditablePage);
      }

      if (allPersonas) {
        setAllAssistants(allPersonas);
        setIsLoadingAllPersonas(isLoadingAllPersonas);
        setCurrentAllPage(currentAllPage);
        setTotalAllPages(totalAllPages);
        setGoToAllPage(goToAllPage);
      }
    } catch (error) {
      console.error("Error fetching personas:", error);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [isAdmin, isCurator]);

  const refreshAssistants = async () => {
    try {
      const response = await fetch("/api/persona", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch assistants");
      let assistants: Persona[] = await response.json();

      let filteredAssistants = filterAssistants(
        assistants,
        hasAnyConnectors,
        hasImageCompatibleModel
      );

      setAssistants(filteredAssistants);

      // Fetch and update allAssistants for admins and curators
      await fetchPersonas();
    } catch (error) {
      console.error("Error refreshing assistants:", error);
    }
  };

  const {
    visibleAssistants,
    hiddenAssistants,
    finalAssistants,
    ownedButHiddenAssistants,
  } = useMemo(() => {
    const { visibleAssistants, hiddenAssistants } = classifyAssistants(
      user,
      assistants
    );

    const finalAssistants = user
      ? orderAssistantsForUser(visibleAssistants, user)
      : visibleAssistants;

    const ownedButHiddenAssistants = getUserCreatedAssistants(
      user,
      hiddenAssistants
    );

    return {
      visibleAssistants,
      hiddenAssistants,
      finalAssistants,
      ownedButHiddenAssistants,
    };
  }, [user, assistants]);

  return (
    <AssistantsContext.Provider
      value={{
        assistants,
        visibleAssistants,
        hiddenAssistants,
        finalAssistants,
        ownedButHiddenAssistants,
        refreshAssistants,
        editablePersonas,
        isLoadingEditablePersonas,
        currentEditablePage,
        totalEditablePages,
        goToEditablePage,
        allAssistants,
        isLoadingAllPersonas,
        currentAllPage,
        totalAllPages,
        goToAllPage,
        isImageGenerationAvailable,
        setPinnedAssistants,
        pinnedAssistants,
      }}
    >
      {children}
    </AssistantsContext.Provider>
  );
};

export const useAssistants = (): AssistantsContextProps => {
  const context = useContext(AssistantsContext);
  if (!context) {
    throw new Error("useAssistants must be used within an AssistantsProvider");
  }
  return context;
};
