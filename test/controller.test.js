import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createAppController } from "../src/cli/controller.js";
import { createUserMessage } from "../src/core/conversation.js";
import { createProviderRegistry } from "../src/core/providers.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-controller-"));
}

function createTestConsole() {
  return {
    log() {},
    error() {},
  };
}

function createTestSpinner() {
  return {
    start() {},
    stop() {},
  };
}

test("load command restores an explicitly empty saved model", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({
    providersFile,
    env: {
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://api.openai.example/v1",
    },
  });
  providerRegistry.setActive("openai");
  providerRegistry.setModel("gpt-live");

  const controller = createAppController({
    providerRegistry,
    historyDir: dir,
    systemPrompt: "system",
    useInteractiveInput: false,
    spinner: createTestSpinner(),
    deps: {
      console: createTestConsole(),
      loadConversationFile: () => ({
        providerName: "openai",
        model: "",
        temperature: 0.2,
        history: [createUserMessage("hello")],
      }),
    },
  });

  await controller.processInput(".load session.md");

  assert.equal(providerRegistry.getModel(), "");
  assert.equal(controller.getHistory().length, 1);
});

test("retry command resends the last completed user exchange instead of duplicating history", async (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const providerRegistry = createProviderRegistry({
    providersFile,
    env: {
      MISTRAL_API_KEY: "mistral-key",
    },
  });
  providerRegistry.setModel("mistral-small");

  let completionCount = 0;
  const controller = createAppController({
    providerRegistry,
    historyDir: dir,
    systemPrompt: "system",
    useInteractiveInput: false,
    spinner: createTestSpinner(),
    deps: {
      console: createTestConsole(),
      buildModelMessages: async () => [],
      renderFull() {},
      generateOpenAICompatibleCompletion: async () => {
        completionCount += 1;
        return {
          text: completionCount === 1 ? "first reply" : "retry reply",
          usage: null,
          durationMs: 5,
        };
      },
    },
  });

  await controller.processInput("hello");
  await controller.processInput(".retry");

  const history = controller.getHistory();
  assert.equal(history.length, 2);
  assert.equal(history[0].role, "user");
  assert.equal(history[1].role, "assistant");
  assert.equal(history[1].parts[0].text, "retry reply");
  assert.equal(completionCount, 2);
});
