import ReactMarkdown from "react-markdown";
import { LoadingAnimation } from "@/components/Loading";
import { AdvancedOptionsToggle } from "@/components/AdvancedOptionsToggle";
import Text from "@/components/ui/text";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Form, Formik } from "formik";
import { FiTrash } from "react-icons/fi";
import { LLM_PROVIDERS_ADMIN_URL } from "./constants";
import {
  SelectorFormField,
  TextFormField,
  MultiSelectField,
  FileUploadFormField,
} from "@/components/Field";
import { useState } from "react";
import { useSWRConfig } from "swr";
import {
  LLMProviderView,
  ModelConfiguration,
  WellKnownLLMProviderDescriptor,
} from "./interfaces";
import { FetchModelsButton } from "./FetchModelsButton";
import { PopupSpec } from "@/components/admin/connectors/Popup";
import * as Yup from "yup";
import isEqual from "lodash/isEqual";
import { IsPublicGroupSelector } from "@/components/IsPublicGroupSelector";

export function LLMProviderUpdateForm({
  llmProviderDescriptor,
  onClose,
  existingLlmProvider,
  shouldMarkAsDefault,
  setPopup,
  hideSuccess,
  firstTimeConfiguration = false,
}: {
  llmProviderDescriptor: WellKnownLLMProviderDescriptor;
  onClose: () => void;
  existingLlmProvider?: LLMProviderView;
  shouldMarkAsDefault?: boolean;
  setPopup?: (popup: PopupSpec) => void;
  hideSuccess?: boolean;

  // Set this when this is the first time the user is setting Onyx up.
  firstTimeConfiguration?: boolean;
}) {
  const { mutate } = useSWRConfig();

  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string>("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string>("");

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Helper function to get current model configurations
  const getCurrentModelConfigurations = (values: any): ModelConfiguration[] => {
    return values.fetched_model_configurations?.length > 0
      ? values.fetched_model_configurations
      : llmProviderDescriptor.model_configurations;
  };

  // Define the initial values based on the provider's requirements
  const initialValues = {
    name:
      existingLlmProvider?.name || (firstTimeConfiguration ? "Default" : ""),
    api_key: existingLlmProvider?.api_key ?? "",
    api_base:
      existingLlmProvider?.api_base ??
      llmProviderDescriptor.default_api_base ??
      "",
    api_version: existingLlmProvider?.api_version ?? "",
    // For Azure OpenAI, combine api_base and api_version into target_uri
    target_uri:
      llmProviderDescriptor.name === "azure" &&
      existingLlmProvider?.api_base &&
      existingLlmProvider?.api_version
        ? `${existingLlmProvider.api_base}/openai/deployments/your-deployment?api-version=${existingLlmProvider.api_version}`
        : "",
    default_model_name:
      existingLlmProvider?.default_model_name ??
      (llmProviderDescriptor.default_model ||
        llmProviderDescriptor.model_configurations[0]?.name),
    fast_default_model_name:
      existingLlmProvider?.fast_default_model_name ??
      (llmProviderDescriptor.default_fast_model || null),
    custom_config:
      existingLlmProvider?.custom_config ??
      llmProviderDescriptor.custom_config_keys?.reduce(
        (acc, customConfigKey) => {
          acc[customConfigKey.name] = "";
          return acc;
        },
        {} as { [key: string]: string }
      ),
    is_public: existingLlmProvider?.is_public ?? true,
    groups: existingLlmProvider?.groups ?? [],
    model_configurations: existingLlmProvider?.model_configurations ?? [],
    deployment_name: existingLlmProvider?.deployment_name,

    // This field only exists to store the selected model-names.
    // It is *not* passed into the JSON body that is submitted to the backend APIs.
    // It will be deleted from the map prior to submission.
    selected_model_names: existingLlmProvider
      ? existingLlmProvider.model_configurations
          .filter((modelConfiguration) => modelConfiguration.is_visible)
          .map((modelConfiguration) => modelConfiguration.name)
      : // default case - use built in "visible" models
        (llmProviderDescriptor.model_configurations
          .filter((modelConfiguration) => modelConfiguration.is_visible)
          .map((modelConfiguration) => modelConfiguration.name) as string[]),

    // Store fetched model configurations in form state instead of mutating props
    fetched_model_configurations: [] as ModelConfiguration[],

    // Helper field to force re-renders when model list updates
    _modelListUpdated: 0,
  };

  // Setup validation schema if required
  const validationSchema = Yup.object({
    name: Yup.string().required("Display Name is required"),
    api_key: llmProviderDescriptor.api_key_required
      ? Yup.string().required("API Key is required")
      : Yup.string(),
    api_base:
      llmProviderDescriptor.api_base_required &&
      llmProviderDescriptor.name !== "azure"
        ? Yup.string().required("API Base is required")
        : Yup.string(),
    api_version:
      llmProviderDescriptor.api_version_required &&
      llmProviderDescriptor.name !== "azure"
        ? Yup.string().required("API Version is required")
        : Yup.string(),
    target_uri:
      llmProviderDescriptor.name === "azure"
        ? Yup.string()
            .required("Target URI is required")
            .test(
              "valid-target-uri",
              "Target URI must be a valid URL with exactly one query parameter (api-version)",
              (value) => {
                if (!value) return false;
                try {
                  const url = new URL(value);
                  const params = new URLSearchParams(url.search);
                  const paramKeys = Array.from(params.keys());

                  // Check if there's exactly one parameter and it's api-version
                  return (
                    paramKeys.length === 1 &&
                    paramKeys[0] === "api-version" &&
                    !!params.get("api-version")
                  );
                } catch {
                  return false;
                }
              }
            )
        : Yup.string(),
    ...(llmProviderDescriptor.custom_config_keys
      ? {
          custom_config: Yup.object(
            llmProviderDescriptor.custom_config_keys.reduce(
              (acc, customConfigKey) => {
                if (customConfigKey.is_required) {
                  acc[customConfigKey.name] = Yup.string().required(
                    `${
                      customConfigKey.display_name || customConfigKey.name
                    } is required`
                  );
                }
                return acc;
              },
              {} as { [key: string]: Yup.StringSchema }
            )
          ),
        }
      : {}),
    deployment_name: llmProviderDescriptor.deployment_name_required
      ? Yup.string().required("Deployment Name is required")
      : Yup.string().nullable(),
    default_model_name: Yup.string().required("Model name is required"),
    fast_default_model_name: Yup.string().nullable(),
    // EE Only
    is_public: Yup.boolean().required(),
    groups: Yup.array().of(Yup.number()),
    selected_model_names: Yup.array().of(Yup.string()),
    fetched_model_configurations: Yup.array(),
  });

  const customLinkRenderer = ({ href, children }: any) => {
    return (
      <a href={href} className="text-link hover:text-link-hover">
        {children}
      </a>
    );
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting }) => {
        setSubmitting(true);

        // build final payload
        const {
          selected_model_names: visibleModels,
          model_configurations: modelConfigurations,
          target_uri,
          _modelListUpdated,
          ...rest
        } = values;

        // For Azure OpenAI, parse target_uri to extract api_base and api_version
        let finalApiBase = rest.api_base;
        let finalApiVersion = rest.api_version;

        if (llmProviderDescriptor.name === "azure" && target_uri) {
          try {
            const url = new URL(target_uri);
            finalApiBase = url.origin; // Only use origin (protocol + hostname + port)
            finalApiVersion = url.searchParams.get("api-version") || "";
          } catch (error) {
            // This should not happen due to validation, but handle gracefully
            console.error("Failed to parse target_uri:", error);
          }
        }

        // Create the final payload with proper typing
        const finalValues = {
          ...rest,
          api_base: finalApiBase,
          api_version: finalApiVersion,
          api_key_changed: values.api_key !== initialValues.api_key,
          model_configurations: getCurrentModelConfigurations(values).map(
            (modelConfiguration): ModelConfiguration => ({
              name: modelConfiguration.name,
              is_visible: visibleModels.includes(modelConfiguration.name),
              max_input_tokens: modelConfiguration.max_input_tokens ?? null,
              supports_image_input: modelConfiguration.supports_image_input,
            })
          ),
        };

        // test the configuration
        if (!isEqual(finalValues, initialValues)) {
          setIsTesting(true);

          const response = await fetch("/api/admin/llm/test", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: llmProviderDescriptor.name,
              ...finalValues,
            }),
          });
          setIsTesting(false);

          if (!response.ok) {
            const errorMsg = (await response.json()).detail;
            setTestError(errorMsg);
            return;
          }
        }

        const response = await fetch(
          `${LLM_PROVIDERS_ADMIN_URL}${
            existingLlmProvider ? "" : "?is_creation=true"
          }`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              provider: llmProviderDescriptor.name,
              ...finalValues,
              fast_default_model_name:
                finalValues.fast_default_model_name ||
                finalValues.default_model_name,
            }),
          }
        );

        if (!response.ok) {
          const errorMsg = (await response.json()).detail;
          const fullErrorMsg = existingLlmProvider
            ? `Failed to update provider: ${errorMsg}`
            : `Failed to enable provider: ${errorMsg}`;
          if (setPopup) {
            setPopup({
              type: "error",
              message: fullErrorMsg,
            });
          } else {
            alert(fullErrorMsg);
          }
          return;
        }

        if (shouldMarkAsDefault) {
          const newLlmProvider = (await response.json()) as LLMProviderView;
          const setDefaultResponse = await fetch(
            `${LLM_PROVIDERS_ADMIN_URL}/${newLlmProvider.id}/default`,
            {
              method: "POST",
            }
          );
          if (!setDefaultResponse.ok) {
            const errorMsg = (await setDefaultResponse.json()).detail;
            const fullErrorMsg = `Failed to set provider as default: ${errorMsg}`;
            if (setPopup) {
              setPopup({
                type: "error",
                message: fullErrorMsg,
              });
            } else {
              alert(fullErrorMsg);
            }
            return;
          }
        }

        mutate(LLM_PROVIDERS_ADMIN_URL);
        onClose();

        const successMsg = existingLlmProvider
          ? "Provider updated successfully!"
          : "Provider enabled successfully!";
        if (!hideSuccess && setPopup) {
          setPopup({
            type: "success",
            message: successMsg,
          });
        } else {
          alert(successMsg);
        }

        setSubmitting(false);
      }}
    >
      {(formikProps) => {
        // Get current model configurations for this render
        const currentModelConfigurations = getCurrentModelConfigurations(
          formikProps.values
        );

        return (
          <Form className="gap-y-4 items-stretch mt-6">
            {!firstTimeConfiguration && (
              <TextFormField
                name="name"
                label="Display Name"
                subtext="A name which you can use to identify this provider when selecting it in the UI."
                placeholder="Display Name"
                disabled={existingLlmProvider ? true : false}
              />
            )}

            {llmProviderDescriptor.api_key_required && (
              <TextFormField
                small={firstTimeConfiguration}
                name="api_key"
                label="API Key"
                placeholder="API Key"
                type="password"
              />
            )}

            {llmProviderDescriptor.name === "azure" ? (
              <TextFormField
                small={firstTimeConfiguration}
                name="target_uri"
                label="Target URI"
                placeholder="https://your-resource.cognitiveservices.azure.com/openai/deployments/deployment-name/chat/completions?api-version=2025-01-01-preview"
                subtext="The complete Azure OpenAI endpoint URL including the API version as a query parameter"
              />
            ) : (
              <>
                {llmProviderDescriptor.api_base_required && (
                  <TextFormField
                    small={firstTimeConfiguration}
                    name="api_base"
                    label="API Base"
                    placeholder="API Base"
                  />
                )}

                {llmProviderDescriptor.api_version_required && (
                  <TextFormField
                    small={firstTimeConfiguration}
                    name="api_version"
                    label="API Version"
                    placeholder="API Version"
                  />
                )}
              </>
            )}

            {llmProviderDescriptor.custom_config_keys?.map(
              (customConfigKey) => {
                if (customConfigKey.key_type === "text_input") {
                  return (
                    <div key={customConfigKey.name}>
                      <TextFormField
                        small={firstTimeConfiguration}
                        name={`custom_config.${customConfigKey.name}`}
                        optional={!customConfigKey.is_required}
                        label={customConfigKey.display_name}
                        subtext={
                          <ReactMarkdown components={{ a: customLinkRenderer }}>
                            {customConfigKey.description}
                          </ReactMarkdown>
                        }
                        placeholder={customConfigKey.default_value || undefined}
                        type={customConfigKey.is_secret ? "password" : "text"}
                      />
                    </div>
                  );
                } else if (customConfigKey.key_type === "file_input") {
                  return (
                    <FileUploadFormField
                      key={customConfigKey.name}
                      name={`custom_config.${customConfigKey.name}`}
                      label={customConfigKey.display_name}
                      subtext={customConfigKey.description || undefined}
                    />
                  );
                } else {
                  throw new Error(
                    "Unreachable; there should only exist 2 options"
                  );
                }
              }
            )}

            {/* Fetch models button - automatically shows for supported providers */}
            <FetchModelsButton
              llmProviderDescriptor={llmProviderDescriptor}
              existingLlmProvider={existingLlmProvider}
              values={formikProps.values}
              setFieldValue={formikProps.setFieldValue}
              isFetchingModels={isFetchingModels}
              setIsFetchingModels={setIsFetchingModels}
              fetchModelsError={fetchModelsError}
              setFetchModelsError={setFetchModelsError}
              setPopup={setPopup}
            />

            {!firstTimeConfiguration && (
              <>
                <Separator />

                {currentModelConfigurations.length > 0 ? (
                  <SelectorFormField
                    name="default_model_name"
                    subtext="The model to use by default for this provider unless otherwise specified."
                    label="Default Model"
                    options={currentModelConfigurations.map(
                      (modelConfiguration) => ({
                        // don't clean up names here to give admins descriptive names / handle duplicates
                        // like us.anthropic.claude-3-7-sonnet-20250219-v1:0 and anthropic.claude-3-7-sonnet-20250219-v1:0
                        name: modelConfiguration.name,
                        value: modelConfiguration.name,
                      })
                    )}
                    maxHeight="max-h-56"
                  />
                ) : (
                  <TextFormField
                    name="default_model_name"
                    subtext="The model to use by default for this provider unless otherwise specified."
                    label="Default Model"
                    placeholder="E.g. gpt-4"
                  />
                )}

                {llmProviderDescriptor.deployment_name_required && (
                  <TextFormField
                    name="deployment_name"
                    label="Deployment Name"
                    placeholder="Deployment Name"
                  />
                )}

                {!llmProviderDescriptor.single_model_supported &&
                  (currentModelConfigurations.length > 0 ? (
                    <SelectorFormField
                      name="fast_default_model_name"
                      subtext={`The model to use for lighter flows like \`LLM Chunk Filter\`
            for this provider. If \`Default\` is specified, will use
            the Default Model configured above.`}
                      label="[Optional] Fast Model"
                      options={currentModelConfigurations.map(
                        (modelConfiguration) => ({
                          // don't clean up names here to give admins descriptive names / handle duplicates
                          // like us.anthropic.claude-3-7-sonnet-20250219-v1:0 and anthropic.claude-3-7-sonnet-20250219-v1:0
                          name: modelConfiguration.name,
                          value: modelConfiguration.name,
                        })
                      )}
                      includeDefault
                      maxHeight="max-h-56"
                    />
                  ) : (
                    <TextFormField
                      name="fast_default_model_name"
                      subtext={`The model to use for lighter flows like \`LLM Chunk Filter\`
            for this provider. If \`Default\` is specified, will use
            the Default Model configured above.`}
                      label="[Optional] Fast Model"
                      placeholder="E.g. gpt-4"
                    />
                  ))}

                <>
                  <Separator />
                  <AdvancedOptionsToggle
                    showAdvancedOptions={showAdvancedOptions}
                    setShowAdvancedOptions={setShowAdvancedOptions}
                  />
                  {showAdvancedOptions && (
                    <>
                      {currentModelConfigurations.length > 0 && (
                        <div className="w-full">
                          <MultiSelectField
                            selectedInitially={
                              formikProps.values.selected_model_names ?? []
                            }
                            name="selected_model_names"
                            label="Display Models"
                            subtext="Select the models to make available to users. Unselected models will not be available."
                            options={currentModelConfigurations.map(
                              (modelConfiguration) => ({
                                value: modelConfiguration.name,
                                // don't clean up names here to give admins descriptive names / handle duplicates
                                // like us.anthropic.claude-3-7-sonnet-20250219-v1:0 and anthropic.claude-3-7-sonnet-20250219-v1:0
                                label: modelConfiguration.name,
                              })
                            )}
                            onChange={(selected) =>
                              formikProps.setFieldValue(
                                "selected_model_names",
                                selected
                              )
                            }
                          />
                        </div>
                      )}
                      <IsPublicGroupSelector
                        formikProps={formikProps}
                        objectName="LLM Provider"
                        publicToWhom="Users"
                        enforceGroupSelection={true}
                      />
                    </>
                  )}
                </>
              </>
            )}

            {/* NOTE: this is above the test button to make sure it's visible */}
            {testError && <Text className="text-error mt-2">{testError}</Text>}

            <div className="flex w-full mt-4">
              <Button type="submit" variant="submit">
                {isTesting ? (
                  <LoadingAnimation text="Testing" />
                ) : existingLlmProvider ? (
                  "Update"
                ) : (
                  "Enable"
                )}
              </Button>
              {existingLlmProvider && (
                <Button
                  type="button"
                  variant="destructive"
                  className="ml-3"
                  icon={FiTrash}
                  onClick={async () => {
                    const response = await fetch(
                      `${LLM_PROVIDERS_ADMIN_URL}/${existingLlmProvider.id}`,
                      {
                        method: "DELETE",
                      }
                    );
                    if (!response.ok) {
                      const errorMsg = (await response.json()).detail;
                      alert(`Failed to delete provider: ${errorMsg}`);
                      return;
                    }

                    // If the deleted provider was the default, set the first remaining provider as default
                    const remainingProvidersResponse = await fetch(
                      LLM_PROVIDERS_ADMIN_URL
                    );
                    if (remainingProvidersResponse.ok) {
                      const remainingProviders =
                        await remainingProvidersResponse.json();

                      if (remainingProviders.length > 0) {
                        const setDefaultResponse = await fetch(
                          `${LLM_PROVIDERS_ADMIN_URL}/${remainingProviders[0].id}/default`,
                          {
                            method: "POST",
                          }
                        );
                        if (!setDefaultResponse.ok) {
                          console.error("Failed to set new default provider");
                        }
                      }
                    }

                    mutate(LLM_PROVIDERS_ADMIN_URL);
                    onClose();
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </Form>
        );
      }}
    </Formik>
  );
}
