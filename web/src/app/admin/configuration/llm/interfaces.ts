import { PopupSpec } from "@/components/admin/connectors/Popup";

export interface CustomConfigKey {
  name: string;
  display_name: string;
  description: string | null;
  is_required: boolean;
  is_secret: boolean;
  key_type: CustomConfigKeyType;
  default_value?: string;
}

export type CustomConfigKeyType = "text_input" | "file_input";

export interface ModelConfiguration {
  name: string;
  is_visible: boolean;
  max_input_tokens: number | null;
  supports_image_input: boolean | null;
}

export interface WellKnownLLMProviderDescriptor {
  name: string;
  display_name: string;

  deployment_name_required: boolean;
  api_key_required: boolean;
  api_base_required: boolean;
  api_version_required: boolean;

  single_model_supported: boolean;
  custom_config_keys: CustomConfigKey[] | null;
  model_configurations: ModelConfiguration[];
  default_model: string | null;
  default_fast_model: string | null;
  default_api_base: string | null;
  is_public: boolean;
  groups: number[];
}

export interface LLMModelDescriptor {
  modelName: string;
  provider: string;
  maxTokens: number;
}

export interface LLMProvider {
  name: string;
  provider: string;
  api_key: string | null;
  api_base: string | null;
  api_version: string | null;
  custom_config: { [key: string]: string } | null;
  default_model_name: string;
  fast_default_model_name: string | null;
  is_public: boolean;
  groups: number[];
  deployment_name: string | null;
  default_vision_model: string | null;
  is_default_vision_provider: boolean | null;
  model_configurations: ModelConfiguration[];
}

export interface LLMProviderView extends LLMProvider {
  id: number;
  is_default_provider: boolean | null;
  icon?: React.FC<{ size?: number; className?: string }>;
}

export interface VisionProvider extends LLMProviderView {
  vision_models: string[];
}

export interface LLMProviderDescriptor {
  name: string;
  provider: string;
  default_model_name: string;
  fast_default_model_name: string | null;
  is_default_provider: boolean | null;
  is_public: boolean;
  groups: number[];
  model_configurations: ModelConfiguration[];
}

export interface ProviderFetchModelsButtonConfig {
  buttonText: string;
  loadingText: string;
  helperText: string | React.ReactNode;
  isDisabled: (values: any) => boolean;
}

export interface FetchModelsButtonProps {
  llmProviderDescriptor: WellKnownLLMProviderDescriptor;
  existingLlmProvider?: LLMProviderView;
  values: any;
  setFieldValue: any;
  isFetchingModels: boolean;
  setIsFetchingModels: (loading: boolean) => void;
  fetchModelsError: string;
  setFetchModelsError: (error: string) => void;
  setPopup?: (popup: PopupSpec) => void;
}

export interface OllamaModelResponse {
  name: string;
  max_input_tokens: number;
  supports_image_input: boolean;
}

export interface FetchModelsConfig<
  TApiResponse = any,
  TProcessedResponse = ModelConfiguration,
> {
  endpoint: string;
  validationCheck: () => boolean;
  validationError: string;
  requestBody: () => Record<string, any>;
  processResponse: (data: TApiResponse) => TProcessedResponse[];
  getModelNames: (data: TApiResponse) => string[];
  successMessage: (count: number) => string;
}
