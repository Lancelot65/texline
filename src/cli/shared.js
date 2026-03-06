import { bold, dim } from "../ui/theme.js";

export function normalizeCliValue(value) {
  return String(value || "").trim();
}

export function formatModelLabel(value) {
  return value ? bold(value) : dim("(no model)");
}

export function formatPlainModelLabel(value) {
  return value ? value : dim("(no model)");
}

export function setActiveModel(context, model) {
  context.state.model = normalizeCliValue(model);
  context.providerRegistry.setModel(context.state.model);
  context.providerRegistry.addKnownModel(context.providerRegistry.getActiveName(), context.state.model);
}

export function syncModelFromActiveProvider(context) {
  context.state.model = context.providerRegistry.getModel();
  context.providerRegistry.addKnownModel(context.providerRegistry.getActiveName(), context.state.model);
  return context.state.model;
}

export function switchProvider(context, name) {
  if (!context.providerRegistry.setActive(name)) return false;
  syncModelFromActiveProvider(context);
  return true;
}
