import {
  AnthropicIcon,
  AmazonIcon,
  CPUIcon,
  MicrosoftIconSVG,
  MistralIcon,
  MetaIcon,
  GeminiIcon,
  IconProps,
  DeepseekIcon,
  OpenAISVG,
  QwenIcon,
} from "@/components/icons/icons";
import {
  ModelConfiguration,
  WellKnownLLMProviderDescriptor,
  LLMProviderView,
} from "./interfaces";
import { PopupSpec } from "@/components/admin/connectors/Popup";

export const getProviderIcon = (
  providerName: string,
  modelName?: string
): (({ size, className }: IconProps) => JSX.Element) => {
  const iconMap: Record<
    string,
    ({ size, className }: IconProps) => JSX.Element
  > = {
    amazon: AmazonIcon,
    phi: MicrosoftIconSVG,
    mistral: MistralIcon,
    ministral: MistralIcon,
    llama: MetaIcon,
    gemini: GeminiIcon,
    deepseek: DeepseekIcon,
    claude: AnthropicIcon,
    anthropic: AnthropicIcon,
    openai: OpenAISVG,
    microsoft: MicrosoftIconSVG,
    meta: MetaIcon,
    google: GeminiIcon,
    qwen: QwenIcon,
    qwq: QwenIcon,
  };

  // First check if provider name directly matches an icon
  const lowerProviderName = providerName.toLowerCase();
  if (lowerProviderName in iconMap) {
    const icon = iconMap[lowerProviderName];
    if (icon) {
      return icon;
    }
  }

  // Then check if model name contains any of the keys
  if (modelName) {
    const lowerModelName = modelName.toLowerCase();
    for (const [key, icon] of Object.entries(iconMap)) {
      if (lowerModelName.includes(key)) {
        return icon;
      }
    }
  }

  // Fallback to CPU icon if no matches
  return CPUIcon;
};

export const isAnthropic = (provider: string, modelName: string) =>
  provider === "anthropic" || modelName.toLowerCase().includes("claude");

export const fetchModels = async (
  llmProviderDescriptor: WellKnownLLMProviderDescriptor,
  existingLlmProvider: LLMProviderView | undefined,
  values: any,
  setFieldValue: any,
  setIsFetchingModels: (loading: boolean) => void,
  setFetchModelsError: (error: string) => void,
  setPopup?: (popup: PopupSpec) => void
) => {
  // Provider-specific configurations
  const providerConfigs = {
    bedrock: {
      endpoint: "/api/admin/llm/bedrock/available-models",
      validationCheck: () => !!values.custom_config?.AWS_REGION_NAME,
      validationError: "AWS region is required to fetch Bedrock models",
      requestBody: () => ({
        aws_region_name: values.custom_config?.AWS_REGION_NAME,
        aws_access_key_id: values.custom_config?.AWS_ACCESS_KEY_ID,
        aws_secret_access_key: values.custom_config?.AWS_SECRET_ACCESS_KEY,
        aws_bearer_token_bedrock:
          values.custom_config?.AWS_BEARER_TOKEN_BEDROCK,
        provider_name: existingLlmProvider?.name,
      }),
      processResponse: (data: string[]) =>
        data.map((modelName) => {
          const existingConfig =
            llmProviderDescriptor.model_configurations.find(
              (config) => config.name === modelName
            );
          return {
            name: modelName,
            is_visible: existingConfig?.is_visible ?? false,
            max_input_tokens: null,
            supports_image_input: existingConfig?.supports_image_input ?? null,
          };
        }),
      getModelNames: (data: string[]) => data,
      successMessage: (count: number) =>
        `Successfully fetched ${count} models for the selected region (including cross-region inference models).`,
    },
    ollama: {
      endpoint: "/api/admin/llm/ollama/available-models",
      validationCheck: () => !!values.api_base,
      validationError: "API Base is required to fetch Ollama models",
      requestBody: () => ({
        api_base: values.api_base,
      }),
      processResponse: (
        data: {
          name: string;
          max_input_tokens: number;
          supports_image_input: boolean;
        }[]
      ) =>
        data.map((modelData) => {
          const existingConfig =
            llmProviderDescriptor.model_configurations.find(
              (config) => config.name === modelData.name
            );
          return {
            name: modelData.name,
            is_visible: existingConfig?.is_visible ?? false,
            max_input_tokens: modelData.max_input_tokens,
            supports_image_input: modelData.supports_image_input,
          };
        }),
      getModelNames: (
        data: {
          name: string;
          max_input_tokens: number;
          supports_image_input: boolean;
        }[]
      ) => data.map((model) => model.name),
      successMessage: (count: number) =>
        `Successfully fetched ${count} models from Ollama.`,
    },
  };

  const config =
    providerConfigs[llmProviderDescriptor.name as keyof typeof providerConfigs];
  if (!config) {
    return;
  }

  // Validation check
  if (!config.validationCheck()) {
    setFetchModelsError(config.validationError);
    return;
  }

  setIsFetchingModels(true);
  setFetchModelsError("");

  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config.requestBody()),
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

    const availableModels = await response.json();
    const updatedModelConfigs = config.processResponse(availableModels);
    const availableModelNames = config.getModelNames(availableModels);

    // Store the updated model configurations in form state instead of mutating props
    setFieldValue("fetched_model_configurations", updatedModelConfigs);

    // Update selected model names to only include previously visible models that are available
    const previouslySelectedModels = values.selected_model_names || [];
    const stillAvailableSelectedModels = previouslySelectedModels.filter(
      (modelName: string) => availableModelNames.includes(modelName)
    );
    setFieldValue("selected_model_names", stillAvailableSelectedModels);

    // Set a default model if none is set
    if (
      (!values.default_model_name ||
        !availableModelNames.includes(values.default_model_name)) &&
      availableModelNames.length > 0
    ) {
      setFieldValue("default_model_name", availableModelNames[0]);
    }

    // Clear fast model if it's not in the new list
    if (
      values.fast_default_model_name &&
      !availableModelNames.includes(values.fast_default_model_name)
    ) {
      setFieldValue("fast_default_model_name", null);
    }

    // Force a re-render by updating a timestamp or counter
    setFieldValue("_modelListUpdated", Date.now());

    setPopup?.({
      message: config.successMessage(availableModelNames.length),
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
