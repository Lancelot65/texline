import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

function createProvider(provider, providerName, apiKey) {
  return createOpenAICompatible({
    name: providerName,
    baseURL: provider.baseURL,
    apiKey,
  });
}

function createChatModel(provider, providerName, apiKey, modelId) {
  return createProvider(provider, providerName, apiKey).chatModel(modelId);
}

export function extractErrorMessage(error) {
  if (!error) return "unknown error";
  if (typeof error === "string") return error;
  if (typeof error?.error?.message === "string") return error.error.message;
  if (typeof error?.message === "string") return error.message;
  return String(error);
}

function normalizeTokenCount(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object") return null;

  const inputTokens = normalizeTokenCount(usage.inputTokens ?? usage.promptTokens);
  const outputTokens = normalizeTokenCount(usage.outputTokens ?? usage.completionTokens);
  const totalTokens = normalizeTokenCount(
    usage.totalTokens ?? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null)
  );

  if (inputTokens === null && outputTokens === null && totalTokens === null) return null;
  return { inputTokens, outputTokens, totalTokens };
}

export async function generateOpenAICompatibleCompletion({
  provider,
  providerName,
  apiKey,
  model,
  messages,
  temperature,
}) {
  if (!apiKey) {
    throw new Error(`missing API key (env ${provider.apiKeyEnv || "?"}) for provider '${providerName}'`);
  }

  try {
    const startedAt = Date.now();
    const result = await generateText({
      model: createChatModel(provider, providerName, apiKey, model),
      messages,
      temperature,
    });
    return {
      text: result.text || "",
      usage: normalizeUsage(result.usage),
      durationMs: Math.max(1, Date.now() - startedAt),
    };
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}

function normalizeModelIds(modelEntries) {
  const ids = modelEntries
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (typeof entry?.id === "string") return entry.id;
      if (typeof entry?.name === "string") return entry.name;
      return "";
    })
    .filter(Boolean);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

export async function fetchOpenAICompatibleModels({
  provider,
  providerName,
  apiKey,
}) {
  if (!apiKey) {
    throw new Error(`missing API key (env ${provider.apiKeyEnv || "?"}) for provider '${providerName}'`);
  }

  try {
    const response = await fetch(`${provider.baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) {
      let errorDetail = `${response.status} ${response.statusText}`;
      try {
        const errorBody = await response.json();
        errorDetail = extractErrorMessage(errorBody) || errorDetail;
      } catch {
        // Keep the HTTP status fallback when the body is not JSON.
      }
      throw new Error(errorDetail);
    }

    const payload = await response.json();
    const modelIds = normalizeModelIds(payload?.data || payload?.models || []);
    if (modelIds.length === 0) {
      throw new Error(`provider '${providerName}' returned no models`);
    }
    return modelIds;
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}
