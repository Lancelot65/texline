import { bold } from "../ui/theme.js";
import { logCliError, logCliInfo, logCliSuccess } from "./logging.js";
import { formatModelLabel, formatPlainModelLabel, normalizeCliValue, setActiveModel } from "./shared.js";

export function createModelSettingsActions(context, selectors) {
  async function updateModel(modelArg) {
    let nextModel = modelArg;
    if (!nextModel && context.useInteractiveInput) {
      nextModel = await selectors.selectModelFromProvider("Select model");
    }
    if (!nextModel) {
      logCliInfo(
        context,
        `current model (${context.providerRegistry.getActiveName()}): ${formatModelLabel(context.state.model)}`
      );
      return;
    }

    const previousModel = context.state.model;
    setActiveModel(context, nextModel);
    logCliSuccess(
      context,
      `model (${context.providerRegistry.getActiveName()}): ${formatPlainModelLabel(previousModel)} → ${formatModelLabel(context.state.model)}`
    );
  }

  async function handleModelsCommand(args) {
    const sub = normalizeCliValue(args[0]);
    const shouldRefresh = sub === "refresh" || sub === "-r" || sub === "--refresh";

    if (sub === "use") {
      let nextModel = args.slice(1).join(" ").trim();
      if (!nextModel && context.useInteractiveInput) {
        nextModel = (await selectors.selectModelFromProvider("Select model")) || "";
      }
      if (!nextModel) {
        logCliError(context, "usage: .models use <model_id>");
        return;
      }
      await updateModel(nextModel);
      return;
    }

    if (sub && !shouldRefresh) {
      logCliError(context, "usage: .models [refresh] | .models use <model_id>");
      return;
    }

    try {
      const modelIds = await selectors.listProviderModels(shouldRefresh);
      context.runtime.printModels(context.providerRegistry.getActiveName(), modelIds, context.state.model);
    } catch (error) {
      logCliError(context, error.message);
    }
  }

  function updateTemperature(tempArg) {
    if (!tempArg) {
      logCliInfo(context, `temperature: ${bold(String(context.state.temperature))}`);
      return;
    }

    const nextTemp = parseFloat(tempArg);
    if (Number.isNaN(nextTemp) || nextTemp < 0 || nextTemp > 1) {
      logCliError(context, "temperature must be a number between 0 and 1.");
      return;
    }
    context.state.temperature = nextTemp;
    logCliSuccess(context, `temperature set to ${bold(String(context.state.temperature))}`);
  }

  return {
    handleModelsCommand,
    updateModel,
    updateTemperature,
  };
}
