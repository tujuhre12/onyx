"use client";

import React from "react";
import { FetchError } from "@/lib/fetcher";
import { ErrorCallout } from "@/components/ErrorCallout";
import { LoadingAnimation } from "@/components/Loading";
import { PopupSpec, usePopup } from "@/components/admin/connectors/Popup";
import { CCPairBasicInfo, ValidSources } from "@/lib/types";
import {
  Credential,
  GmailCredentialJson,
  GmailServiceAccountCredentialJson,
} from "@/lib/connectors/credentials";
import { GmailAuthSection, GmailJsonUploadSection } from "./Credential";
import { usePublicCredentials, useBasicConnectorStatus } from "@/lib/hooks";
import Title from "@/components/ui/title";
import { useUser } from "@/components/user/UserProvider";
import {
  useGoogleAppCredential,
  useGoogleServiceAccountKey,
  useGoogleCredentials,
  useConnectorsByCredentialId,
  checkCredentialsFetched,
  filterUploadedCredentials,
  checkConnectorsExist,
  refreshAllGoogleData,
} from "@/lib/googleConnectorHooks";

export const GmailMain = () => {
  const { isAdmin, user } = useUser();
  const { popup, setPopup } = usePopup();

  // Get app credential and service account key
  const {
    data: appCredentialData,
    isLoading: isAppCredentialLoading,
    error: isAppCredentialError,
  } = useGoogleAppCredential("gmail");

  const {
    data: serviceAccountKeyData,
    isLoading: isServiceAccountKeyLoading,
    error: isServiceAccountKeyError,
  } = useGoogleServiceAccountKey("gmail");

  // Get connector statuses
  const {
    data: connectorIndexingStatuses,
    isLoading: isConnectorIndexingStatusesLoading,
    error: connectorIndexingStatusesError,
  } = useBasicConnectorStatus();

  // Get all public credentials
  const {
    data: credentialsData,
    isLoading: isCredentialsLoading,
    error: credentialsError,
    refreshCredentials,
  } = usePublicCredentials();

  // Get Gmail-specific credentials
  const {
    data: gmailCredentials,
    isLoading: isGmailCredentialsLoading,
    error: gmailCredentialsError,
  } = useGoogleCredentials(ValidSources.Gmail);

  // Filter uploaded credentials and get credential ID
  const { credential_id, uploadedCredentials } =
    filterUploadedCredentials(gmailCredentials);

  // Get connectors for the credential ID
  const {
    data: gmailConnectors,
    isLoading: isGmailConnectorsLoading,
    error: gmailConnectorsError,
    refreshConnectorsByCredentialId,
  } = useConnectorsByCredentialId(credential_id);

  // Check if credentials were successfully fetched
  const {
    appCredentialSuccessfullyFetched,
    serviceAccountKeySuccessfullyFetched,
  } = checkCredentialsFetched(
    appCredentialData,
    isAppCredentialError,
    serviceAccountKeyData,
    isServiceAccountKeyError
  );

  // Handle refresh of all data
  const handleRefresh = () => {
    refreshCredentials();
    refreshConnectorsByCredentialId();
    refreshAllGoogleData(ValidSources.Gmail);
  };

  // Loading state
  if (
    (!appCredentialSuccessfullyFetched && isAppCredentialLoading) ||
    (!serviceAccountKeySuccessfullyFetched && isServiceAccountKeyLoading) ||
    (!connectorIndexingStatuses && isConnectorIndexingStatusesLoading) ||
    (!credentialsData && isCredentialsLoading) ||
    (!gmailCredentials && isGmailCredentialsLoading) ||
    (!gmailConnectors && isGmailConnectorsLoading)
  ) {
    return (
      <div className="mx-auto">
        <LoadingAnimation text="" />
      </div>
    );
  }

  // Error states
  if (credentialsError || !credentialsData) {
    return <ErrorCallout errorTitle="Failed to load credentials." />;
  }

  if (gmailCredentialsError || !gmailCredentials) {
    return <ErrorCallout errorTitle="Failed to load Gmail credentials." />;
  }

  if (connectorIndexingStatusesError || !connectorIndexingStatuses) {
    return <ErrorCallout errorTitle="Failed to load connectors." />;
  }

  if (
    !appCredentialSuccessfullyFetched ||
    !serviceAccountKeySuccessfullyFetched
  ) {
    return (
      <ErrorCallout errorTitle="Error loading Gmail app credentials. Contact an administrator." />
    );
  }

  if (gmailConnectorsError) {
    return (
      <ErrorCallout errorTitle="Failed to load Gmail associated connectors." />
    );
  }

  // Check if connectors exist
  const connectorExistsFromCredential = checkConnectorsExist(gmailConnectors);

  // Get the uploaded OAuth credential
  const gmailPublicUploadedCredential:
    | Credential<GmailCredentialJson>
    | undefined = credentialsData.find(
    (credential) =>
      credential.credential_json?.google_tokens &&
      credential.admin_public &&
      credential.source === "gmail" &&
      credential.credential_json.authentication_method !== "oauth_interactive"
  );

  // Get the service account credential
  const gmailServiceAccountCredential:
    | Credential<GmailServiceAccountCredentialJson>
    | undefined = credentialsData.find(
    (credential) =>
      credential.credential_json?.google_service_account_key &&
      credential.source === "gmail"
  );

  // Filter connector statuses for Gmail
  const gmailConnectorIndexingStatuses: CCPairBasicInfo[] =
    connectorIndexingStatuses.filter(
      (connectorIndexingStatus) => connectorIndexingStatus.source === "gmail"
    );

  const connectorExists =
    connectorExistsFromCredential || gmailConnectorIndexingStatuses.length > 0;

  // Check if credentials have been uploaded and processed
  const hasUploadedCredentials =
    Boolean(appCredentialData?.client_id) ||
    Boolean(serviceAccountKeyData?.service_account_email);

  return (
    <>
      {popup}
      <Title className="mb-2 mt-6 ml-auto mr-auto">
        Step 1: Provide your Credentials
      </Title>
      <GmailJsonUploadSection
        setPopup={setPopup}
        appCredentialData={appCredentialData}
        serviceAccountCredentialData={serviceAccountKeyData}
        isAdmin={isAdmin}
        onSuccess={handleRefresh}
      />

      {isAdmin && hasUploadedCredentials && (
        <>
          <Title className="mb-2 mt-6 ml-auto mr-auto">
            Step 2: Authenticate with Onyx
          </Title>
          <GmailAuthSection
            setPopup={setPopup}
            refreshCredentials={handleRefresh}
            gmailPublicCredential={gmailPublicUploadedCredential}
            gmailServiceAccountCredential={gmailServiceAccountCredential}
            appCredentialData={appCredentialData}
            serviceAccountKeyData={serviceAccountKeyData}
            connectorExists={connectorExists}
            user={user}
          />
        </>
      )}
    </>
  );
};
