"use client";

import { LoadingAnimation } from "@/components/Loading";
import { NotebookIcon } from "@/components/icons/icons";
import { CCPairIndexingStatusTable } from "./CCPairIndexingStatusTable";
import { AdminPageTitle } from "@/components/admin/Title";
import Link from "next/link";
import Text from "@/components/ui/text";
import { useConnectorCredentialIndexingStatus } from "@/lib/hooks";
import {
  PopupMessages,
  usePopupFromQuery,
} from "@/components/popup/PopupFromQuery";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { ConnectorCreatedSuccessModal } from "./ConnectorCreatedSuccessModal";
import { useMemo } from "react";

// Constants
const ADD_CONNECTOR_PATH = "/admin/add-connector";

const ConnectorStatusList = () => {
  const {
    data: indexAttemptData,
    isLoading: indexAttemptIsLoading,
    error: indexAttemptError,
  } = useConnectorCredentialIndexingStatus();

  const {
    data: editableIndexAttemptData,
    isLoading: editableIndexAttemptIsLoading,
    error: editableIndexAttemptError,
  } = useConnectorCredentialIndexingStatus(undefined, true);

  // Handle loading state
  if (indexAttemptIsLoading || editableIndexAttemptIsLoading) {
    return <LoadingAnimation text="" />;
  }

  // Handle error states
  if (
    indexAttemptError ||
    !indexAttemptData ||
    editableIndexAttemptError ||
    !editableIndexAttemptData
  ) {
    return (
      <div className="text-error">
        {indexAttemptError?.info?.detail ||
          editableIndexAttemptError?.info?.detail ||
          "Error loading indexing history."}
      </div>
    );
  }

  // Show empty state when no connectors
  if (indexAttemptData.length === 0) {
    return (
      <Text>
        It looks like you don&apos;t have any connectors setup yet. Visit the{" "}
        <Link className="text-link" href={ADD_CONNECTOR_PATH}>
          Add Connector
        </Link>{" "}
        page to get started!
      </Text>
    );
  }

  // Sort data by source name
  const sortedIndexAttemptData = [...indexAttemptData].sort((a, b) =>
    a.connector.source.localeCompare(b.connector.source)
  );

  return (
    <>
      <CCPairIndexingStatusTable
        ccPairsIndexingStatuses={sortedIndexAttemptData}
        editableCcPairsIndexingStatuses={editableIndexAttemptData}
      />
    </>
  );
};

export default function Status() {
  const searchParams = useSearchParams();
  const justCreatedConnector =
    searchParams.get("message") === "connector-created";

  // Use data to determine if we should show the popup or modal
  const { data: indexAttemptData, isLoading: indexAttemptIsLoading } =
    useConnectorCredentialIndexingStatus();

  // Only show popup if we're not showing the success modal and there's exactly one seeded connector
  const showSuccessModal = useMemo(() => {
    return (
      !indexAttemptIsLoading &&
      indexAttemptData &&
      justCreatedConnector &&
      indexAttemptData.filter((attempt) => attempt.is_seeded).length === 1
    );
  }, [indexAttemptIsLoading, indexAttemptData]);

  // Create popup messages based on query parameters
  const popupMessages: PopupMessages = {
    "connector-deleted": {
      message: "Connector deleted successfully",
      type: "success",
    },
  };

  // Conditionally add connector-created message
  if (!showSuccessModal) {
    Object.assign(popupMessages, {
      "connector-created": {
        message: "Connector created successfully",
        type: "success",
      },
    });
  }

  const { popup } = usePopupFromQuery(popupMessages);

  return (
    <div className="mx-auto container">
      {popup}
      <AdminPageTitle
        icon={<NotebookIcon size={32} />}
        title="Existing Connectors"
        farRightElement={
          <Link href={ADD_CONNECTOR_PATH}>
            <Button variant="success-reverse">Add Connector</Button>
          </Link>
        }
      />

      {showSuccessModal && <ConnectorCreatedSuccessModal />}

      <ConnectorStatusList />
    </div>
  );
}
