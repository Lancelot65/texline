import { filterChatModelIds } from "../core/chatModels.js";
import { buildChoiceList, selectWithSearch } from "./prompt.js";

export function createModelSelectors(context) {
  async function listProviderModels(forceRefresh = false) {
    const providerName = context.providerRegistry.getActiveName();
    if (!forceRefresh) {
      const cached = context.providerRegistry.getCachedModels(providerName);
      if (cached.length > 0) return filterChatModelIds(cached, context.state.model);
    }

    const provider = context.providerRegistry.getActive();
    const apiKey = context.providerRegistry.resolveApiKey(provider);
    const modelIds = await context.runtime.fetchOpenAICompatibleModels({
      provider,
      providerName,
      apiKey,
    });
    context.providerRegistry.cacheModels(providerName, modelIds);
    return filterChatModelIds(modelIds, context.state.model);
  }

  async function selectModelFromProvider(promptMessage) {
    const modelIds = await listProviderModels(false);
    if (modelIds.length === 0) return null;

    return selectWithSearch({
      message: promptMessage,
      defaultValue: context.state.model,
      choices: buildChoiceList(modelIds, (modelId) => ({
        value: modelId,
        name: modelId,
        description: modelId === context.state.model ? "current model" : undefined,
      })),
    });
  }

  async function selectProviderName(promptMessage) {
    const providerNames = context.providerRegistry
      .listNames()
      .sort((left, right) => left.localeCompare(right));

    return selectWithSearch({
      message: promptMessage,
      defaultValue: context.providerRegistry.getActiveName(),
      choices: buildChoiceList(providerNames, (providerName) => {
        const provider = context.providerRegistry.getProviders()[providerName];
        return {
          value: providerName,
          name: providerName,
          description:
            providerName === context.providerRegistry.getActiveName()
              ? `current · ${provider.model || "(no model)"}`
              : `${provider.model || "(no model)"} · ${provider.baseURL}`,
        };
      }),
    });
  }

  return {
    listProviderModels,
    selectModelFromProvider,
    selectProviderName,
  };
}
