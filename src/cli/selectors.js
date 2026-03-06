import { createModelSelectors } from "./modelSelectors.js";
import { createSavedSessionSelectors } from "./savedSessionSelectors.js";

export function createSelectors(context) {
  return {
    ...createModelSelectors(context),
    ...createSavedSessionSelectors(context),
  };
}
