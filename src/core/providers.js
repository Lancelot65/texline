import path from "path";
import Conf from "conf";

function uniqueNonEmptyStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function sanitizeBaseURL(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function pickDefaultActiveProvider(env, providers) {
  const providerNames = Object.keys(providers);
  if (providerNames.length === 0) return "mistral";

  const providerWithKey = providerNames.find((name) => {
    const apiKeyEnv = String(providers[name]?.apiKeyEnv || "").trim();
    return !!(apiKeyEnv && env[apiKeyEnv]);
  });
  if (providerWithKey) return providerWithKey;

  if (
    providers.openai &&
    (env.OPENAI_BASE_URL || env.OPENAI_API_KEY || env.OPENAI_API_KEY_ENV)
  ) {
    return "openai";
  }

  if (
    providers.mistral &&
    (env.MISTRAL_BASE_URL || env.MISTRAL_API_KEY || env.MISTRAL_API_KEY_ENV)
  ) {
    return "mistral";
  }

  return providerNames[0];
}

function defaultProvidersConfig(env) {
  const base = {
    providers: {
      mistral: {
        baseURL: env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1",
        apiKeyEnv: env.MISTRAL_API_KEY_ENV || "MISTRAL_API_KEY",
        model: "",
      },
    },
  };

  if (env.OPENAI_API_KEY || env.OPENAI_BASE_URL) {
    base.providers.openai = {
      baseURL: env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      apiKeyEnv: "OPENAI_API_KEY",
      model: "",
    };
  }

  base.activeProvider = pickDefaultActiveProvider(env, base.providers);
  return base;
}

function normalizeProviderConfig(name, raw) {
  return {
    baseURL: sanitizeBaseURL(raw?.baseURL || ""),
    apiKeyEnv: String(raw?.apiKeyEnv || "").trim(),
    apiKey: raw?.apiKey ? String(raw.apiKey).trim() : undefined,
    model: String(raw?.model || "").trim(),
  };
}

function normalizeLoadedConfig(raw, env) {
  const defaults = defaultProvidersConfig(env);
  const providers = {};
  for (const [name, cfg] of Object.entries(raw?.providers || {})) {
    const key = String(name || "").trim();
    if (!key) continue;
    providers[key] = normalizeProviderConfig(key, cfg);
  }
  if (Object.keys(providers).length === 0) return defaults;

  const activeCandidate = String(raw?.activeProvider || "").trim();
  const activeProvider = providers[activeCandidate] ? activeCandidate : Object.keys(providers)[0];
  return { activeProvider, providers };
}

function createProvidersStore(providersFile, defaults) {
  const cwd = path.dirname(providersFile);
  const configName = path.basename(providersFile, path.extname(providersFile));
  return new Conf({
    projectName: "tui_chat",
    cwd,
    configName,
    defaults,
    serialize: (value) => `${JSON.stringify(value, null, 2)}\n`,
    deserialize: (value) => JSON.parse(value),
  });
}

export function createProviderRegistry({ providersFile, env = process.env }) {
  const defaults = defaultProvidersConfig(env);
  const providersStore = createProvidersStore(providersFile, defaults);
  const providerModelCache = new Map();
  const providerKnownModels = new Map();
  let providerConfig = normalizeLoadedConfig(providersStore.store, env);

  function save() {
    providersStore.store = providerConfig;
  }

  function listNames() {
    return Object.keys(providerConfig.providers);
  }

  function getProviders() {
    return providerConfig.providers;
  }

  function getActiveName() {
    return providerConfig.activeProvider;
  }

  function getActive() {
    return providerConfig.providers[getActiveName()];
  }

  function ensureActiveProvider() {
    if (getActive()) return;
    const fallback = listNames()[0];
    if (fallback) providerConfig.activeProvider = fallback;
  }

  function setActive(name) {
    if (!providerConfig.providers[name]) return false;
    providerConfig.activeProvider = name;
    save();
    return true;
  }

  function resolveApiKey(provider = getActive()) {
    if (!provider) return null;
    if (provider.apiKey) return provider.apiKey;
    const envName = provider.apiKeyEnv;
    if (!envName) return null;
    return env[envName] || null;
  }

  function getModel() {
    return String(getActive()?.model || "").trim();
  }

  function setModel(model) {
    const active = getActive();
    if (!active) return false;
    active.model = model;
    addKnownModel(getActiveName(), model);
    save();
    return true;
  }

  function cacheModels(providerName, modelIds) {
    providerModelCache.set(
      providerName,
      uniqueNonEmptyStrings(modelIds).sort((a, b) => a.localeCompare(b))
    );
  }

  function getCachedModels(providerName = getActiveName()) {
    return providerModelCache.get(providerName) || [];
  }

  function addKnownModel(providerName, model) {
    if (!providerName || !model) return;
    const known = providerKnownModels.get(providerName) || [];
    providerKnownModels.set(
      providerName,
      uniqueNonEmptyStrings([...known, model]).sort((a, b) => a.localeCompare(b))
    );
  }

  function getKnownModels(providerName = getActiveName(), history = [], currentModel = null) {
    const provider = providerConfig.providers[providerName];
    const historyModels = history
      .filter((message) => message.role === "assistant" && message?.metadata?.provider === providerName)
      .map((message) => message?.metadata?.model);

    return uniqueNonEmptyStrings([
      provider?.model,
      currentModel,
      ...getCachedModels(providerName),
      ...(providerKnownModels.get(providerName) || []),
      ...historyModels,
    ]).sort((a, b) => a.localeCompare(b));
  }

  function addProvider(name, baseURL, apiKeyEnv, defaultModel) {
    const model = String(defaultModel || "").trim();
    providerConfig.providers[name] = normalizeProviderConfig(name, {
      baseURL,
      apiKeyEnv,
      model,
    });
    addKnownModel(name, model);
    save();
  }

  function removeProvider(name) {
    delete providerConfig.providers[name];
    providerModelCache.delete(name);
    providerKnownModels.delete(name);
    if (getActiveName() === name) {
      const nextProvider = listNames()[0];
      providerConfig.activeProvider = nextProvider;
    }
    save();
  }

  ensureActiveProvider();
  save();

  return {
    providersFile: providersStore.path,
    listNames,
    getProviders,
    getActiveName,
    getActive,
    setActive,
    resolveApiKey,
    getModel,
    setModel,
    addProvider,
    removeProvider,
    cacheModels,
    getCachedModels,
    addKnownModel,
    getKnownModels,
  };
}
