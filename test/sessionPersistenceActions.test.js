import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSessionPersistenceActions } from "../src/cli/sessionPersistenceActions.js";
import { createUserMessage } from "../src/core/conversation.js";
import { createProviderRegistry } from "../src/core/providers.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-session-persistence-"));
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

function createContext({ providerRegistry, historyDir, useInteractiveInput = false, model = "", temperature = 0.15 }) {
  const logs = createLogs();
  return {
    messages: logs.messages,
    context: {
      providerRegistry,
      historyDir,
      useInteractiveInput,
      history: [],
      state: {
        model,
        temperature,
      },
      runtime: {
        console: logs.console,
        dirname: path.dirname,
        joinPath: path.join,
        mkdirSync: fs.mkdirSync,
        resolvePath: path.resolve,
        writeFileSync: fs.writeFileSync,
        now: () => 123,
      },
    },
  };
}

test("saveConversation refuses empty history", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context, messages } = createContext({
    providerRegistry,
    historyDir: path.join(dir, ".history"),
    model: providerRegistry.getModel(),
  });

  const actions = createSessionPersistenceActions(
    context,
    { selectSavedConversation: async () => null },
    { renderConversationHistory() {} }
  );

  actions.saveConversation("");

  assert.match(messages[0], /history is empty/);
  assert.equal(fs.existsSync(path.join(dir, ".history", "texline_123.md")), false);
});

test("saveConversation writes the default history file", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context } = createContext({
    providerRegistry,
    historyDir: path.join(dir, ".history"),
    model: providerRegistry.getModel(),
  });
  context.history.push(createUserMessage("hello"));
  context.runtime.renderConversationMarkdown = () => "# session";

  const actions = createSessionPersistenceActions(
    context,
    { selectSavedConversation: async () => null },
    { renderConversationHistory() {} }
  );

  actions.saveConversation("");

  const savedFile = path.join(dir, ".history", "texline_123.md");
  assert.equal(fs.existsSync(savedFile), true);
  assert.equal(fs.readFileSync(savedFile, "utf8"), "# session");
});

test("loadConversation reports when no interactive saved sessions are available", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  const { context, messages } = createContext({
    providerRegistry,
    historyDir: path.join(dir, ".history"),
    model: providerRegistry.getModel(),
    useInteractiveInput: true,
  });

  const actions = createSessionPersistenceActions(
    context,
    { selectSavedConversation: async () => null },
    { renderConversationHistory() {} }
  );

  const loaded = await actions.loadConversation("");

  assert.equal(loaded, false);
  assert.match(messages[0], /no saved conversations/);
});

test("loadConversation preserves the local provider when a saved provider is not configured", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({ providersFile, env: { MISTRAL_API_KEY: "mistral-key" } });
  providerRegistry.setModel("mistral-small");

  const { context, messages } = createContext({
    providerRegistry,
    historyDir: path.join(dir, ".history"),
    model: providerRegistry.getModel(),
  });
  context.runtime.loadConversationFile = () => ({
    providerName: "openai",
    model: "gpt-x",
    temperature: 0.4,
    history: [createUserMessage("hello")],
  });

  const actions = createSessionPersistenceActions(
    context,
    { selectSavedConversation: async () => null },
    { renderConversationHistory() {} }
  );

  const loaded = await actions.loadConversation("saved.md");

  assert.equal(loaded, true);
  assert.equal(providerRegistry.getActiveName(), "mistral");
  assert.equal(context.state.model, "mistral-small");
  assert.equal(context.state.temperature, 0.4);
  assert.equal(context.history.length, 1);
  assert.match(messages[0], /not configured locally/);
});
