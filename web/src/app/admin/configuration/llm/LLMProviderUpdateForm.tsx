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
  ModelConfigurationUpsertRequest,
  WellKnownLLMProviderDescriptor,
} from "./interfaces";
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

  // Define the initial values based on the provider's requirements
  const initialValues = {
    name:
      existingLlmProvider?.name || (firstTimeConfiguration ? "Default" : ""),
    api_key: existingLlmProvider?.api_key ?? "",
    api_base:
      existingLlmProvider?.api_base ??
      (llmProviderDescriptor.name === "ollama" ? "http://127.0.0.1:11434" : ""),
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
  });

  const customLinkRenderer = ({ href, children }: any) => {
    return (
      <a href={href} className="text-link hover:text-link-hover">
        {children}
      </a>
    );
  };

  const fetchBedrockModels = async (values: any, setFieldValue: any) => {
    if (llmProviderDescriptor.name !== "bedrock") {
      return;
    }

    setIsFetchingModels(true);
    setFetchModelsError("");

    try {
      const response = await fetch("/api/admin/llm/bedrock/available-models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aws_region_name: values.custom_config?.AWS_REGION_NAME,
          aws_access_key_id: values.custom_config?.AWS_ACCESS_KEY_ID,
          aws_secret_access_key: values.custom_config?.AWS_SECRET_ACCESS_KEY,
          aws_bearer_token_bedrock:
            values.custom_config?.AWS_BEARER_TOKEN_BEDROCK,
          provider_name: existingLlmProvider?.name, // Save models to existing provider if editing
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch models");
      }

      const availableModels: string[] = await response.json();

      // Update the model configurations with the fetched models
      const updatedModelConfigs = availableModels.map((modelName) => {
        // Find existing configuration to preserve is_visible setting
        const existingConfig = llmProviderDescriptor.model_configurations.find(
          (config) => config.name === modelName
        );

        return {
          name: modelName,
          is_visible: existingConfig?.is_visible ?? false, // Preserve existing visibility or default to false
          max_input_tokens: null,
          supports_image_input: false, // Will be determined by the backend
        };
      });

      // Update the descriptor and form values
      llmProviderDescriptor.model_configurations = updatedModelConfigs;

      // Update selected model names to only include previously visible models that are available
      const previouslySelectedModels = values.selected_model_names || [];
      const stillAvailableSelectedModels = previouslySelectedModels.filter(
        (modelName: string) => availableModels.includes(modelName)
      );
      setFieldValue("selected_model_names", stillAvailableSelectedModels);

      // Set a default model if none is set
      if (
        (!values.default_model_name ||
          !availableModels.includes(values.default_model_name)) &&
        availableModels.length > 0
      ) {
        setFieldValue("default_model_name", availableModels[0]);
      }

      // Clear fast model if it's not in the new list
      if (
        values.fast_default_model_name &&
        !availableModels.includes(values.fast_default_model_name)
      ) {
        setFieldValue("fast_default_model_name", null);
      }

      // Force a re-render by updating a timestamp or counter
      setFieldValue("_modelListUpdated", Date.now());

      setPopup?.({
        message: `Successfully fetched ${availableModels.length} models for the selected region (including cross-region inference models).`,
        type: "success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setFetchModelsError(errorMessage);
      setPopup?.({
        message: `Failed to fetch models: ${errorMessage}`,
        type: "error",
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const fetchOllamaModels = async (values: any, setFieldValue: any) => {
    if (!values.api_base) {
      setFetchModelsError("API Base is required to fetch Ollama models");
      return;
    }

    setIsFetchingModels(true);
    setFetchModelsError("");

    try {
      const response = await fetch("/api/admin/llm/ollama/available-models", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_base: values.api_base,
          provider_name: existingLlmProvider?.name,
        }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to fetch models";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // ignore JSON parsing errors and use the fallback message
        }

        throw new Error(errorMessage);
      }

      const availableModels: string[] = await response.json();

      const updatedModelConfigs = availableModels.map((modelName) => {
        const existingConfig = llmProviderDescriptor.model_configurations.find(
          (config) => config.name === modelName
        );

        return {
          name: modelName,
          is_visible: existingConfig?.is_visible ?? false,
          max_input_tokens: null,
          supports_image_input: false,
        };
      });

      llmProviderDescriptor.model_configurations = updatedModelConfigs;

      const previouslySelectedModels = values.selected_model_names || [];
      const stillAvailableSelectedModels = previouslySelectedModels.filter(
        (modelName: string) => availableModels.includes(modelName)
      );

      setFieldValue("selected_model_names", stillAvailableSelectedModels);

      if (
        (!values.default_model_name ||
          !availableModels.includes(values.default_model_name)) &&
        availableModels.length > 0
      ) {
        setFieldValue("default_model_name", availableModels[0]);
      }

      if (
        values.fast_default_model_name &&
        !availableModels.includes(values.fast_default_model_name)
      ) {
        setFieldValue("fast_default_model_name", null);
      }

      setFieldValue("_modelListUpdated", Date.now());

      setPopup?.({
        message: `Successfully fetched ${availableModels.length} models from Ollama.`,
        type: "success",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setFetchModelsError(errorMessage);
      setPopup?.({
        message: `Failed to fetch models: ${errorMessage}`,
        type: "error",
      });
    } finally {
      setIsFetchingModels(false);
    }
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
          model_configurations: llmProviderDescriptor.model_configurations.map(
            (modelConfiguration): ModelConfigurationUpsertRequest => ({
              name: modelConfiguration.name,
              is_visible: visibleModels.includes(modelConfiguration.name),
              max_input_tokens: null,
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
      {(formikProps) => (
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

          {llmProviderDescriptor.custom_config_keys?.map((customConfigKey) => {
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
              throw new Error("Unreachable; there should only exist 2 options");
            }
          })}

          {/* Bedrock-specific fetch models button */}
          {llmProviderDescriptor.name === "bedrock" && (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() =>
                  fetchBedrockModels(
                    formikProps.values,
                    formikProps.setFieldValue
                  )
                }
                disabled={
                  isFetchingModels ||
                  !formikProps.values.custom_config?.AWS_REGION_NAME
                }
                className="w-fit"
              >
                {isFetchingModels ? (
                  <>
                    <LoadingAnimation size="text-sm" />
                    <span className="ml-2">Fetching Models...</span>
                  </>
                ) : (
                  "Fetch Available Models for Region"
                )}
              </Button>

              {fetchModelsError && (
                <Text className="text-red-600 text-sm">{fetchModelsError}</Text>
              )}

              <Text className="text-sm text-gray-600">
                Enter your AWS region, then click this button to fetch available
                Bedrock models.
                <br />
                If you&apos;re updating your existing provider, you&apos;ll need
                to click this button to fetch the latest models.
              </Text>
            </div>
          )}

          {llmProviderDescriptor.name === "ollama" && (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                onClick={() =>
                  fetchOllamaModels(
                    formikProps.values,
                    formikProps.setFieldValue
                  )
                }
                disabled={isFetchingModels || !formikProps.values.api_base}
                className="w-fit"
              >
                {isFetchingModels ? (
                  <>
                    <LoadingAnimation size="text-sm" />
                    <span className="ml-2">Fetching Models...</span>
                  </>
                ) : (
                  "Fetch Available Ollama Models"
                )}
              </Button>

              {fetchModelsError && (
                <Text className="text-red-600 text-sm">{fetchModelsError}</Text>
              )}

              <Text className="text-sm text-gray-600">
                Ensure your Ollama server is accessible from Onyx and that the
                requested models are pulled (e.g. via <code>ollama pull</code>).
                Provide the server&apos;s base URL and optional API key (when
                using Ollama Cloud) before fetching the available models.
              </Text>
            </div>
          )}

          {!firstTimeConfiguration && (
            <>
              <Separator />

              {llmProviderDescriptor.model_configurations.length > 0 ? (
                <SelectorFormField
                  name="default_model_name"
                  subtext="The model to use by default for this provider unless otherwise specified."
                  label="Default Model"
                  options={llmProviderDescriptor.model_configurations.map(
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
                (llmProviderDescriptor.model_configurations.length > 0 ? (
                  <SelectorFormField
                    name="fast_default_model_name"
                    subtext={`The model to use for lighter flows like \`LLM Chunk Filter\`
            for this provider. If \`Default\` is specified, will use
            the Default Model configured above.`}
                    label="[Optional] Fast Model"
                    options={llmProviderDescriptor.model_configurations.map(
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
                    {llmProviderDescriptor.model_configurations.length > 0 && (
                      <div className="w-full">
                        <MultiSelectField
                          selectedInitially={
                            formikProps.values.selected_model_names ?? []
                          }
                          name="selected_model_names"
                          label="Display Models"
                          subtext="Select the models to make available to users. Unselected models will not be available."
                          options={llmProviderDescriptor.model_configurations.map(
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
      )}
    </Formik>
  );
}
