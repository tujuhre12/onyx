import { LLMProviderDescriptor } from "@/app/admin/configuration/llm/interfaces";

/**
 * Interface for vision provider from API, matching the backend's VisionProviderResponse Pydantic model
 * We're defining this as a standalone interface rather than extending to avoid type conflicts
 */
export interface VisionProvider {
  // Base provider info
  id: number;
  name: string;
  provider: string;

  // Model fields
  model_names: string[];
  default_model_name: string;
  fast_default_model_name: string | null;
  display_model_names: string[] | null;

  // Provider settings
  api_key?: string | null;
  api_base?: string | null;
  api_version?: string | null;
  custom_config?: Record<string, string> | null;
  deployment_name?: string | null;
  is_public: boolean;
  groups: number[];

  // Default provider flags
  is_default_provider: boolean | null;

  // Vision-specific fields
  vision_models: string[];
  is_default_vision_provider: boolean | null;
  default_vision_model: string | null;
}

export enum ApplicationStatus {
  PAYMENT_REMINDER = "payment_reminder",
  GATED_ACCESS = "gated_access",
  ACTIVE = "active",
}

export enum QueryHistoryType {
  DISABLED = "disabled",
  ANONYMIZED = "anonymized",
  NORMAL = "normal",
}

export interface Settings {
  anonymous_user_enabled: boolean;
  anonymous_user_path?: string;
  maximum_chat_retention_days?: number | null;
  notifications: Notification[];
  needs_reindexing: boolean;
  gpu_enabled: boolean;
  pro_search_enabled?: boolean;
  application_status: ApplicationStatus;
  auto_scroll: boolean;
  temperature_override_enabled: boolean;
  query_history_type: QueryHistoryType;

  // Image processing settings
  image_extraction_and_analysis_enabled?: boolean;
  search_time_image_analysis_enabled?: boolean;
  image_analysis_max_size_mb?: number | null;
}

export enum NotificationType {
  PERSONA_SHARED = "persona_shared",
  REINDEX_NEEDED = "reindex_needed",
  TRIAL_ENDS_TWO_DAYS = "two_day_trial_ending",
}

export interface Notification {
  id: number;
  notif_type: string;
  time_created: string;
  dismissed: boolean;
  additional_data?: {
    persona_id?: number;
    [key: string]: any;
  };
}

export interface NavigationItem {
  link: string;
  icon?: string;
  svg_logo?: string;
  title: string;
}

export interface EnterpriseSettings {
  application_name: string | null;
  use_custom_logo: boolean;
  use_custom_logotype: boolean;

  // custom navigation
  custom_nav_items: NavigationItem[];

  // custom Chat components
  custom_lower_disclaimer_content: string | null;
  custom_header_content: string | null;
  two_lines_for_chat_header: boolean | null;
  custom_popup_header: string | null;
  custom_popup_content: string | null;
  enable_consent_screen: boolean | null;
}

export interface CombinedSettings {
  settings: Settings;
  enterpriseSettings: EnterpriseSettings | null;
  customAnalyticsScript: string | null;
  isMobile?: boolean;
  webVersion: string | null;
  webDomain: string | null;
}
