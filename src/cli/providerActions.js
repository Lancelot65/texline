import { createModelSettingsActions } from "./modelSettingsActions.js";
import { createProviderManagementActions } from "./providerManagementActions.js";

export function createProviderActions(context, selectors) {
  return {
    ...createProviderManagementActions(context, selectors),
    ...createModelSettingsActions(context, selectors),
  };
}
