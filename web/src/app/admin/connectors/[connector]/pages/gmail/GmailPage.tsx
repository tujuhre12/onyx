"use client";

import React from "react";
import useSWR, { mutate } from "swr";
import { FetchError, errorHandlingFetcher } from "@/lib/fetcher";
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
import { ConnectorSnapshot } from "@/lib/connectors/connectors";
import { buildSimilarCredentialInfoURL } from "@/app/admin/connector/[ccPairId]/lib";

const useConnectorsByCredentialId = (credential_id: number | null) => {
  let url: string | null = null;
  if (credential_id !== null) {
    url = `/api/manage/admin/connector?credential=${credential_id}`;
  }
  const swrResponse = useSWR<ConnectorSnapshot[]>(url, errorHandlingFetcher);

  return {
    ...swrResponse,
    refreshConnectorsByCredentialId: () => mutate(url),
  };
};

export const GmailMain = () => {
  const { isAdmin, user } = useUser();
  const { popup, setPopup } = usePopup();

  // tries getting the uploaded credential json
  const {
    data: appCredentialData,
    isLoading: isAppCredentialLoading,
    error: isAppCredentialError,
  } = useSWR<{ client_id: string }, FetchError>(
    "/api/manage/admin/connector/gmail/app-credential",
    errorHandlingFetcher
  );

  // tries getting the uploaded service account key
  const {
    data: serviceAccountKeyData,
    isLoading: isServiceAccountKeyLoading,
    error: isServiceAccountKeyError,
  } = useSWR<{ service_account_email: string }, FetchError>(
    "/api/manage/admin/connector/gmail/service-account-key",
    errorHandlingFetcher
  );

  // gets all connector statuses
  const {
    data: connectorIndexingStatuses,
    isLoading: isConnectorIndexingStatusesLoading,
    error: connectorIndexingStatusesError,
  } = useBasicConnectorStatus();

  // gets all public credentials
  const {
    data: credentialsData,
    isLoading: isCredentialsLoading,
    error: credentialsError,
    refreshCredentials,
  } = usePublicCredentials();

  // gets all credentials for source type gmail
  const {
    data: gmailCredentials,
    isLoading: isGmailCredentialsLoading,
    error: gmailCredentialsError,
  } = useSWR<Credential<any>[]>(
    buildSimilarCredentialInfoURL(ValidSources.Gmail),
    errorHandlingFetcher,
    { refreshInterval: 5000 }
  );

  // filters down to just credentials that were created via upload (there should be only one)
  let credential_id = null;
  if (gmailCredentials) {
    const gmailUploadedCredentials: Credential<GmailCredentialJson>[] =
      gmailCredentials.filter(
        (gmailCredential) =>
          gmailCredential.credential_json.authentication_method !==
          "oauth_interactive"
      );

    if (gmailUploadedCredentials.length > 0) {
      credential_id = gmailUploadedCredentials[0].id;
    }
  }

  // retrieves all connectors for that credential id
  const {
    data: gmailConnectors,
    isLoading: isGmailConnectorsLoading,
    error: gmailConnectorsError,
    refreshConnectorsByCredentialId,
  } = useConnectorsByCredentialId(credential_id);

  const appCredentialSuccessfullyFetched =
    appCredentialData ||
    (isAppCredentialError && isAppCredentialError.status === 404);
  const serviceAccountKeySuccessfullyFetched =
    serviceAccountKeyData ||
    (isServiceAccountKeyError && isServiceAccountKeyError.status === 404);

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

  // get the actual uploaded oauth or service account credentials
  const gmailPublicUploadedCredential:
    | Credential<GmailCredentialJson>
    | undefined = credentialsData.find(
    (credential) =>
      credential.credential_json?.google_tokens &&
      credential.admin_public &&
      credential.source === "gmail" &&
      credential.credential_json.authentication_method !== "oauth_interactive"
  );

  const gmailServiceAccountCredential:
    | Credential<GmailServiceAccountCredentialJson>
    | undefined = credentialsData.find(
    (credential) =>
      credential.credential_json?.google_service_account_key &&
      credential.source === "gmail"
  );

  if (gmailConnectorsError) {
    return (
      <ErrorCallout errorTitle="Failed to load Gmail associated connectors." />
    );
  }

  let connectorExists = false;
  if (gmailConnectors) {
    if (gmailConnectors.length > 0) {
      connectorExists = true;
    }
  }

  // Filter connector statuses for Gmail
  const gmailConnectorIndexingStatuses: CCPairBasicInfo[] =
    connectorIndexingStatuses.filter(
      (connectorIndexingStatus) => connectorIndexingStatus.source === "gmail"
    );

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
      />

      {isAdmin && (
        <>
          <Title className="mb-2 mt-6 ml-auto mr-auto">
            Step 2: Authenticate with Onyx
          </Title>
          <GmailAuthSection
            setPopup={setPopup}
            refreshCredentials={refreshCredentials}
            gmailPublicCredential={gmailPublicUploadedCredential}
            gmailServiceAccountCredential={gmailServiceAccountCredential}
            appCredentialData={appCredentialData}
            serviceAccountKeyData={serviceAccountKeyData}
            connectorExists={
              connectorExists || gmailConnectorIndexingStatuses.length > 0
            }
            user={user}
          />
        </>
      )}
    </>
  );
};
