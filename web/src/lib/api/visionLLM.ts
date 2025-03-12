import { VisionProvider } from "@/app/admin/settings/interfaces";

/**
 * Fetches all LLM providers that support vision capabilities
 */
export async function fetchVisionProviders(): Promise<VisionProvider[]> {
  const response = await fetch("/api/admin/llm/vision-providers", {
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch vision providers: ${await response.text()}`
    );
  }
  return response.json();
}

/**
 * Sets a provider and model as the default vision provider
 */
export async function setDefaultVisionProvider(
  providerId: number,
  visionModel: string
): Promise<void> {
  const response = await fetch(
    `/api/admin/llm/provider/${providerId}/default-vision?vision_model=${encodeURIComponent(
      visionModel
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorMsg = await response.text();
    throw new Error(errorMsg);
  }
}
