import { Button } from "@/components/ui/button";
import { PopupSpec } from "@/components/admin/connectors/Popup";
import React, { useState, useEffect } from "react";
import { useSWRConfig } from "swr";
import * as Yup from "yup";
import { useRouter } from "next/navigation";
import { adminDeleteCredential } from "@/lib/credential";
import { setupGmailOAuth } from "@/lib/gmail";
import { GMAIL_AUTH_IS_ADMIN_COOKIE_NAME } from "@/lib/constants";
import Cookies from "js-cookie";
import {
  TextFormField,
  SectionHeader,
  SubLabel,
} from "@/components/admin/connectors/Field";
import { Form, Formik } from "formik";
import { User } from "@/lib/types";
import CardSection from "@/components/admin/CardSection";
import {
  Credential,
  GmailCredentialJson,
  GmailServiceAccountCredentialJson,
} from "@/lib/connectors/credentials";
import { refreshAllGoogleData } from "@/lib/googleConnector";
import { ValidSources } from "@/lib/types";
import { buildSimilarCredentialInfoURL } from "@/app/admin/connector/[ccPairId]/lib";
import {
  FiFile,
  FiUpload,
  FiTrash2,
  FiCheck,
  FiLink,
  FiAlertTriangle,
} from "react-icons/fi";
import { cn } from "@/lib/utils";

type GmailCredentialJsonTypes = "authorized_user" | "service_account";

const GmailCredentialUpload = ({
  setPopup,
  onSuccess,
}: {
  setPopup: (popupSpec: PopupSpec | null) => void;
  onSuccess?: () => void;
}) => {
  const { mutate } = useSWRConfig();
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | undefined>();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      if (!loadEvent?.target?.result) {
        setIsUploading(false);
        return;
      }

      const credentialJsonStr = loadEvent.target.result as string;

      // Check credential type
      let credentialFileType: GmailCredentialJsonTypes;
      try {
        const appCredentialJson = JSON.parse(credentialJsonStr);
        if (appCredentialJson.web) {
          credentialFileType = "authorized_user";
        } else if (appCredentialJson.type === "service_account") {
          credentialFileType = "service_account";
        } else {
          throw new Error(
            "Unknown credential type, expected one of 'OAuth Web application' or 'Service Account'"
          );
        }
      } catch (e) {
        setPopup({
          message: `Invalid file provided - ${e}`,
          type: "error",
        });
        setIsUploading(false);
        return;
      }

      if (credentialFileType === "authorized_user") {
        const response = await fetch(
          "/api/manage/admin/connector/gmail/app-credential",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: credentialJsonStr,
          }
        );
        if (response.ok) {
          setPopup({
            message: "Successfully uploaded app credentials",
            type: "success",
          });
          mutate("/api/manage/admin/connector/gmail/app-credential");
          if (onSuccess) {
            onSuccess();
          }
        } else {
          const errorMsg = await response.text();
          setPopup({
            message: `Failed to upload app credentials - ${errorMsg}`,
            type: "error",
          });
        }
      }

      if (credentialFileType === "service_account") {
        const response = await fetch(
          "/api/manage/admin/connector/gmail/service-account-key",
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: credentialJsonStr,
          }
        );
        if (response.ok) {
          setPopup({
            message: "Successfully uploaded service account key",
            type: "success",
          });
          mutate("/api/manage/admin/connector/gmail/service-account-key");
          if (onSuccess) {
            onSuccess();
          }
        } else {
          const errorMsg = await response.text();
          setPopup({
            message: `Failed to upload service account key - ${errorMsg}`,
            type: "error",
          });
        }
      }
      setIsUploading(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col mt-4">
      <div className="flex items-center">
        <div className="relative flex flex-1 items-center">
          <label
            className={cn(
              "flex h-10 items-center justify-center w-full px-4 py-2 border border-dashed rounded-md transition-colors",
              isUploading
                ? "opacity-70 cursor-not-allowed border-background-400 bg-background-50/30"
                : "cursor-pointer hover:bg-background-50/30 hover:border-primary dark:hover:border-primary border-background-300 dark:border-background-600"
            )}
          >
            <div className="flex items-center space-x-2">
              {isUploading ? (
                <div className="h-4 w-4 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
              ) : (
                <FiFile className="h-4 w-4 text-text-500" />
              )}
              <span className="text-sm text-text-500">
                {isUploading
                  ? `Uploading ${fileName || "file"}...`
                  : fileName || "Select JSON credentials file..."}
              </span>
            </div>
            <input
              className="sr-only"
              type="file"
              accept=".json"
              disabled={isUploading}
              onChange={(event) => {
                if (!event.target.files?.length) {
                  return;
                }
                const file = event.target.files[0];
                handleFileUpload(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};

interface GmailJsonUploadSectionProps {
  setPopup: (popupSpec: PopupSpec | null) => void;
  appCredentialData?: { client_id: string };
  serviceAccountCredentialData?: { service_account_email: string };
  isAdmin: boolean;
  onSuccess?: () => void;
}

export const GmailJsonUploadSection = ({
  setPopup,
  appCredentialData,
  serviceAccountCredentialData,
  isAdmin,
  onSuccess,
}: GmailJsonUploadSectionProps) => {
  const { mutate } = useSWRConfig();
  const router = useRouter();
  const [localServiceAccountData, setLocalServiceAccountData] = useState(
    serviceAccountCredentialData
  );
  const [localAppCredentialData, setLocalAppCredentialData] =
    useState(appCredentialData);

  // Update local state when props change
  useEffect(() => {
    setLocalServiceAccountData(serviceAccountCredentialData);
    setLocalAppCredentialData(appCredentialData);
  }, [serviceAccountCredentialData, appCredentialData]);

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess();
    } else {
      refreshAllGoogleData(ValidSources.Gmail);
    }
  };

  if (localServiceAccountData?.service_account_email) {
    return (
      <div>
        <SectionHeader>Gmail Service Account Credentials</SectionHeader>
        <div className="mt-4">
          <div className="py-3 px-4 bg-background-50/30 dark:bg-background-900/20 rounded">
            <div>
              <span className="text-sm text-text-500 dark:text-text-400">
                Service Account Email:
              </span>
              <p className="font-medium text-text-900 dark:text-text-100">
                {localServiceAccountData.service_account_email}
              </p>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-4">
              <p className="text-sm text-text-500 dark:text-text-400 mb-3">
                If you want to update these credentials, delete the existing
                credentials below, then upload new credentials.
              </p>
              <Button
                type="button"
                onClick={async () => {
                  const response = await fetch(
                    "/api/manage/admin/connector/gmail/service-account-key",
                    {
                      method: "DELETE",
                    }
                  );
                  if (response.ok) {
                    mutate(
                      "/api/manage/admin/connector/gmail/service-account-key"
                    );
                    // Also mutate the credential endpoints to ensure Step 2 is reset
                    mutate(buildSimilarCredentialInfoURL(ValidSources.Gmail));
                    setPopup({
                      message: "Successfully deleted service account key",
                      type: "success",
                    });
                    // Immediately update local state
                    setLocalServiceAccountData(undefined);
                    handleSuccess();
                  } else {
                    const errorMsg = await response.text();
                    setPopup({
                      message: `Failed to delete service account key - ${errorMsg}`,
                      type: "error",
                    });
                  }
                }}
              >
                Delete Credentials
              </Button>
            </div>
          ) : (
            <p className="text-sm mt-4 text-text-500 dark:text-text-400">
              To change these credentials, please contact an administrator.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (localAppCredentialData?.client_id) {
    return (
      <div>
        <SectionHeader>Gmail OAuth Application Credentials</SectionHeader>
        <div className="mt-4">
          <div className="py-3 px-4 bg-background-50/30 dark:bg-background-900/20 rounded">
            <div className="flex items-center">
              <FiCheck className="text-green-500 h-5 w-5 mr-2" />
              <span className="font-medium">
                Found existing OAuth credentials
              </span>
            </div>
            <div className="mt-2">
              <span className="text-sm text-text-500 dark:text-text-400">
                Client ID:
              </span>
              <p className="font-medium text-text-900 dark:text-text-100">
                {localAppCredentialData.client_id}
              </p>
            </div>
          </div>

          {isAdmin ? (
            <div className="mt-4">
              <p className="text-sm text-text-500 dark:text-text-400 mb-3">
                If you want to update these credentials, delete the existing
                credentials below, then upload new credentials.
              </p>
              <Button
                type="button"
                onClick={async () => {
                  const response = await fetch(
                    "/api/manage/admin/connector/gmail/app-credential",
                    {
                      method: "DELETE",
                    }
                  );
                  if (response.ok) {
                    mutate("/api/manage/admin/connector/gmail/app-credential");
                    // Also mutate the credential endpoints to ensure Step 2 is reset
                    mutate(buildSimilarCredentialInfoURL(ValidSources.Gmail));
                    setPopup({
                      message: "Successfully deleted app credentials",
                      type: "success",
                    });
                    // Immediately update local state
                    setLocalAppCredentialData(undefined);
                    handleSuccess();
                  } else {
                    const errorMsg = await response.text();
                    setPopup({
                      message: `Failed to delete app credential - ${errorMsg}`,
                      type: "error",
                    });
                  }
                }}
              >
                Delete Credentials
              </Button>
            </div>
          ) : (
            <p className="text-sm mt-4 text-text-500 dark:text-text-400">
              To change these credentials, please contact an administrator.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <div className="flex items-start py-3 px-4 bg-yellow-50/30 dark:bg-yellow-900/5 rounded">
          <FiAlertTriangle className="text-yellow-500 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            Curators are unable to set up the Gmail credentials. To add a Gmail
            connector, please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader>Setup Gmail Credentials</SectionHeader>
      <div className="mt-4">
        <p className="text-sm mb-3">
          Follow these steps to connect your Gmail:
        </p>
        <ol className="list-decimal list-inside text-sm space-y-2">
          <li>
            <span className="font-medium">Create credentials</span> - You have
            two options:
            <ul className="list-disc list-inside ml-4 mt-1 text-text-500 dark:text-text-400">
              <li>Set up a Google OAuth App in your company workspace</li>
              <li>Create a Service Account with appropriate permissions</li>
            </ul>
          </li>
          <li>
            <span className="font-medium">Download credentials</span> - Save the
            JSON file to your computer
          </li>
          <li>
            <span className="font-medium">Upload credentials</span> - Select the
            JSON file below to automatically upload
          </li>
        </ol>
        <div className="mt-3 mb-4">
          <a
            className="text-primary hover:text-primary/80 flex items-center gap-1 text-sm"
            target="_blank"
            href="https://docs.onyx.app/connectors/gmail#authorization"
            rel="noreferrer"
          >
            <FiLink className="h-3 w-3" />
            View detailed setup instructions
          </a>
        </div>

        <GmailCredentialUpload setPopup={setPopup} onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

interface GmailCredentialSectionProps {
  gmailPublicCredential?: Credential<GmailCredentialJson>;
  gmailServiceAccountCredential?: Credential<GmailServiceAccountCredentialJson>;
  serviceAccountKeyData?: { service_account_email: string };
  appCredentialData?: { client_id: string };
  setPopup: (popupSpec: PopupSpec | null) => void;
  refreshCredentials: () => void;
  connectorExists: boolean;
  user: User | null;
}

async function handleRevokeAccess(
  connectorExists: boolean,
  setPopup: (popupSpec: PopupSpec | null) => void,
  existingCredential:
    | Credential<GmailCredentialJson>
    | Credential<GmailServiceAccountCredentialJson>,
  refreshCredentials: () => void
) {
  if (connectorExists) {
    const message =
      "Cannot revoke the Gmail credential while any connector is still associated with the credential. " +
      "Please delete all associated connectors, then try again.";
    setPopup({
      message: message,
      type: "error",
    });
    return;
  }

  await adminDeleteCredential(existingCredential.id);
  setPopup({
    message: "Successfully revoked the Gmail credential!",
    type: "success",
  });

  refreshCredentials();
}

export const GmailAuthSection = ({
  gmailPublicCredential,
  gmailServiceAccountCredential,
  serviceAccountKeyData,
  appCredentialData,
  setPopup,
  refreshCredentials,
  connectorExists,
  user,
}: GmailCredentialSectionProps) => {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [localServiceAccountData, setLocalServiceAccountData] = useState(
    serviceAccountKeyData
  );
  const [localAppCredentialData, setLocalAppCredentialData] =
    useState(appCredentialData);
  const [localGmailPublicCredential, setLocalGmailPublicCredential] = useState(
    gmailPublicCredential
  );
  const [
    localGmailServiceAccountCredential,
    setLocalGmailServiceAccountCredential,
  ] = useState(gmailServiceAccountCredential);

  // Update local state when props change
  useEffect(() => {
    setLocalServiceAccountData(serviceAccountKeyData);
    setLocalAppCredentialData(appCredentialData);
    setLocalGmailPublicCredential(gmailPublicCredential);
    setLocalGmailServiceAccountCredential(gmailServiceAccountCredential);
  }, [
    serviceAccountKeyData,
    appCredentialData,
    gmailPublicCredential,
    gmailServiceAccountCredential,
  ]);

  const existingCredential =
    localGmailPublicCredential || localGmailServiceAccountCredential;
  if (existingCredential) {
    return (
      <div>
        <SectionHeader>Gmail Authentication Status</SectionHeader>
        <div className="mt-4">
          <div className="py-3 px-4 bg-green-50/30 dark:bg-green-900/5 rounded mb-4 flex items-start">
            <FiCheck className="text-green-500 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium">Authentication Complete</span>
              <p className="text-sm mt-1 text-text-500 dark:text-text-400">
                Your Gmail credentials have been uploaded and authenticated
                successfully.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={async () => {
              handleRevokeAccess(
                connectorExists,
                setPopup,
                existingCredential,
                refreshCredentials
              );
            }}
          >
            Revoke Access
          </Button>
        </div>
      </div>
    );
  }

  if (localServiceAccountData?.service_account_email) {
    return (
      <div>
        <SectionHeader>Complete Gmail Authentication</SectionHeader>
        <div className="mt-4">
          <div className="py-3 px-4 bg-background-50/30 dark:bg-background-900/20 rounded mb-4">
            <p className="text-sm">
              Enter the email of an admin/owner of the Google Organization that
              owns the Gmail account(s) you want to index.
            </p>
          </div>

          <Formik
            initialValues={{
              google_primary_admin: user?.email || "",
            }}
            validationSchema={Yup.object().shape({
              google_primary_admin: Yup.string()
                .email("Must be a valid email")
                .required("Required"),
            })}
            onSubmit={async (values, formikHelpers) => {
              formikHelpers.setSubmitting(true);
              try {
                const response = await fetch(
                  "/api/manage/admin/connector/gmail/service-account-credential",
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      google_primary_admin: values.google_primary_admin,
                    }),
                  }
                );

                if (response.ok) {
                  setPopup({
                    message: "Successfully created service account credential",
                    type: "success",
                  });
                  refreshCredentials();
                } else {
                  const errorMsg = await response.text();
                  setPopup({
                    message: `Failed to create service account credential - ${errorMsg}`,
                    type: "error",
                  });
                }
              } catch (error) {
                setPopup({
                  message: `Failed to create service account credential - ${error}`,
                  type: "error",
                });
              } finally {
                formikHelpers.setSubmitting(false);
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-4">
                <TextFormField
                  name="google_primary_admin"
                  label="Primary Admin Email:"
                  subtext="Enter the email of an admin/owner of the Google Organization that owns the Gmail account(s) you want to index."
                />
                <div className="flex">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Credential"}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    );
  }

  if (localAppCredentialData?.client_id) {
    return (
      <div>
        <SectionHeader>Complete Gmail Authentication</SectionHeader>
        <div className="mt-4">
          <div className="py-3 px-4 bg-background-50/30 dark:bg-background-900/20 rounded mb-4">
            <p className="text-sm">
              Next, you need to authenticate with Gmail via OAuth. This gives us
              read access to the emails you have access to in your Gmail
              account.
            </p>
          </div>
          <Button
            disabled={isAuthenticating}
            onClick={async () => {
              setIsAuthenticating(true);
              try {
                Cookies.set(GMAIL_AUTH_IS_ADMIN_COOKIE_NAME, "true", {
                  path: "/",
                });
                const [authUrl, errorMsg] = await setupGmailOAuth({
                  isAdmin: true,
                });

                if (authUrl) {
                  router.push(authUrl);
                } else {
                  setPopup({
                    message: errorMsg,
                    type: "error",
                  });
                  setIsAuthenticating(false);
                }
              } catch (error) {
                setPopup({
                  message: `Failed to authenticate with Gmail - ${error}`,
                  type: "error",
                });
                setIsAuthenticating(false);
              }
            }}
          >
            {isAuthenticating ? "Authenticating..." : "Authenticate with Gmail"}
          </Button>
        </div>
      </div>
    );
  }

  // case where no keys have been uploaded in step 1
  return (
    <div>
      <SectionHeader>Gmail Authentication</SectionHeader>
      <div className="mt-4">
        <div className="flex items-start py-3 px-4 bg-yellow-50/30 dark:bg-yellow-900/5 rounded">
          <FiAlertTriangle className="text-yellow-500 h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            Please upload either an OAuth Client Credential JSON or a Gmail
            Service Account Key JSON first before authenticating.
          </p>
        </div>
      </div>
    </div>
  );
};
