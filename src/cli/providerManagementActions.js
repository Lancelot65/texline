import { bold, dim, warn } from "../ui/theme.js";
import { logCliError, logCliSuccess, logCliWarn } from "./logging.js";
import { normalizeCliValue, formatPlainModelLabel, syncModelFromActiveProvider, switchProvider } from "./shared.js";

function isValidProviderName(name) {
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

function hasHttpBaseUrl(baseURL) {
  return /^https?:\/\//.test(baseURL);
}

async function resolveProviderName(context, selectors, promptMessage, rawValue) {
  let name = normalizeCliValue(rawValue);
  if (!name && context.useInteractiveInput) {
    name = (await selectors.selectProviderName(promptMessage)) || "";
  }
  return name;
}

function logProviderSwitch(context, name) {
  logCliSuccess(
    context,
    `provider switched to ${bold(name)} ${dim("·")} model ${formatPlainModelLabel(context.state.model)}`
  );
}

export function createProviderManagementActions(context, selectors) {
  async function handleProviderCommand(args) {
    const sub = normalizeCliValue(args[0]);
    if (!sub) {
      context.runtime.printProviderDetails(context.providerRegistry);
      return;
    }

    if (sub === "use") {
      const name = await resolveProviderName(context, selectors, "Select provider", args[1]);
      if (!name) {
        logCliError(context, "usage: .provider use <name>");
        return;
      }
      if (!switchProvider(context, name)) {
        logCliError(context, `unknown provider: ${warn(name)}`);
        return;
      }
      logProviderSwitch(context, name);
      return;
    }

    if (sub === "add") {
      const name = normalizeCliValue(args[1]);
      const baseURL = normalizeCliValue(args[2]);
      const apiKeyEnv = normalizeCliValue(args[3]);
      const providerModel = args.slice(4).join(" ").trim();

      if (!name || !baseURL || !apiKeyEnv) {
        logCliError(context, "usage: .provider add <name> <base_url> <api_key_env> [model]");
        return;
      }
      if (!isValidProviderName(name)) {
        logCliError(context, "invalid provider name (allowed: a-z A-Z 0-9 . _ -)");
        return;
      }
      if (!hasHttpBaseUrl(baseURL)) {
        logCliError(context, "base_url must start with http:// or https://");
        return;
      }

      context.providerRegistry.addProvider(name, baseURL, apiKeyEnv, providerModel);
      logCliSuccess(
        context,
        `provider ${bold(name)} saved. ${dim("Use")} .provider use ${name} ${dim("to activate.")}`
      );
      return;
    }

    if (sub === "rm" || sub === "remove" || sub === "delete") {
      const name = await resolveProviderName(context, selectors, "Remove provider", args[1]);
      if (!name) {
        logCliError(context, "usage: .provider rm <name>");
        return;
      }
      if (!context.providerRegistry.getProviders()[name]) {
        logCliError(context, `unknown provider: ${warn(name)}`);
        return;
      }
      if (context.providerRegistry.listNames().length <= 1) {
        logCliWarn(context, "cannot remove the last provider.");
        return;
      }

      context.providerRegistry.removeProvider(name);
      syncModelFromActiveProvider(context);
      logCliSuccess(context, `provider removed: ${bold(name)}`);
      return;
    }

    if (!context.providerRegistry.getProviders()[sub]) {
      logCliWarn(context, `unknown provider command or provider: ${warn(sub)}`);
      return;
    }

    switchProvider(context, sub);
    logProviderSwitch(context, sub);
  }

  return {
    handleProviderCommand,
  };
}
