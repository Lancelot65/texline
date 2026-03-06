import { createSessionPersistenceActions } from "./sessionPersistenceActions.js";
import { createSessionRenderActions } from "./sessionRenderActions.js";

export function createSessionActions(context, selectors) {
  const renderActions = createSessionRenderActions(context);
  const persistenceActions = createSessionPersistenceActions(context, selectors, renderActions);

  return {
    ...renderActions,
    ...persistenceActions,
  };
}
