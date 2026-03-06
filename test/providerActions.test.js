import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createModelSettingsActions } from "../src/cli/modelSettingsActions.js";
import { createProviderManagementActions } from "../src/cli/providerManagementActions.js";
import { createProviderRegistry } from "../src/core/providers.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-provider-actions-"));
}

function createLogs() {
  const messages = [];
  return {
    messages,
    console: {
      log(value) {
        messages.push(String(value));
      },
    },
  };
}

function createContext({ providerRegistry, useInteractiveInput = false, temperature = 0.15, model = "" }) {
  const logs = createLogs();
  const context = {
    providerRegistry,
    useInteractiveInput,
    state: {
      model,
      temperature,
    },
    runtime: {
      console: logs.console,
      printProviderDetails() {},
      printModels() {},
    },
  };

  return { context, messages: logs.messages };
}

function createSelectors(overrides = {}) {
  return {
    listProviderModels: async () => [],
    selectModelFromProvider: async () => "",
    selectProviderName: async () => "",
    ...overrides,
  };
}

test("provider add rejects invalid provider names", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context, messages } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
  });
  const actions = createProviderManagementActions(context, createSelectors());

  await actions.handleProviderCommand(["add", "bad name", "https://example.com/v1", "API_KEY"]);

  assert.match(messages[0], /invalid provider name/);
  assert.equal(providerRegistry.getProviders()["bad name"], undefined);
});

test("provider add rejects invalid base URLs", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context, messages } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
  });
  const actions = createProviderManagementActions(context, createSelectors());

  await actions.handleProviderCommand(["add", "openrouter", "example.com/v1", "API_KEY"]);

  assert.match(messages[0], /base_url must start/);
  assert.equal(providerRegistry.getProviders().openrouter, undefined);
});

test("provider remove refuses to delete the last provider", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context, messages } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
  });
  const actions = createProviderManagementActions(context, createSelectors());

  await actions.handleProviderCommand(["rm", "mistral"]);

  assert.match(messages[0], /cannot remove the last provider/);
  assert.equal(providerRegistry.listNames().length, 1);
});

test("provider shorthand switch updates active provider and synced model", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({
    providersFile,
    env: {
      MISTRAL_API_KEY: "mistral-key",
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://api.openai.example/v1",
    },
  });
  providerRegistry.getProviders().openai.model = "gpt-4o-mini";
  providerRegistry.setActive("mistral");

  const { context } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
  });
  const actions = createProviderManagementActions(context, createSelectors());

  await actions.handleProviderCommand(["openai"]);

  assert.equal(providerRegistry.getActiveName(), "openai");
  assert.equal(context.state.model, "gpt-4o-mini");
});

test("updateModel with no argument reports the current model", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  providerRegistry.setModel("mistral-small");

  const { context, messages } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
  });
  const actions = createModelSettingsActions(context, createSelectors());

  await actions.updateModel("");

  assert.match(messages[0], /current model/);
  assert.match(messages[0], /mistral-small/);
});

test("models use updates the active model", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  providerRegistry.setModel("mistral-small");

  const { context } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
  });
  const actions = createModelSettingsActions(context, createSelectors());

  await actions.handleModelsCommand(["use", "mistral-large"]);

  assert.equal(context.state.model, "mistral-large");
  assert.equal(providerRegistry.getModel(), "mistral-large");
});

test("temperature updates accept valid values and reject out-of-range values", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context, messages } = createContext({
    providerRegistry,
    model: providerRegistry.getModel(),
    temperature: 0.15,
  });
  const actions = createModelSettingsActions(context, createSelectors());

  actions.updateTemperature("0.4");
  actions.updateTemperature("1.2");

  assert.equal(context.state.temperature, 0.4);
  assert.match(messages[0], /temperature set to/);
  assert.match(messages[1], /temperature must be a number between 0 and 1/);
});
