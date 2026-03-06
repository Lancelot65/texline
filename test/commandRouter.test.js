import test from "node:test";
import assert from "node:assert/strict";

import { createCommandRouter } from "../src/cli/commandRouter.js";

function createContext() {
  const logs = [];
  return {
    logs,
    context: {
      history: [],
      providerRegistry: {},
      systemPrompt: "system",
      state: {
        shouldExit: false,
      },
      runtime: {
        console: {
          log(value) {
            logs.push(String(value));
          },
        },
        printHelp() {},
        runDoctor() {},
        printProvidersList() {},
        printHistorySummary() {},
        printSystemPrompt() {},
      },
    },
  };
}

test("command router dispatches command handlers with parsed args", async () => {
  const calls = [];
  const { context } = createContext();
  const router = createCommandRouter(context, {
    chat: {
      retryLastMessage: async () => calls.push(["retry"]),
      undoLastExchangeCommand: async () => calls.push(["undo"]),
    },
    filesystem: {
      handleFilesCommand: async (args) => calls.push(["files", args]),
    },
    providers: {
      handleModelsCommand: async (args) => calls.push(["models", args]),
      handleProviderCommand: async (args) => calls.push(["provider", args]),
      updateModel: async (arg) => calls.push(["model", arg]),
      updateTemperature: async (arg) => calls.push(["temp", arg]),
    },
    session: {
      clearConversation: async () => calls.push(["clear"]),
      loadConversation: async (arg) => calls.push(["load", arg]),
      saveConversation: async (arg) => calls.push(["save", arg]),
    },
  });

  await router.handleCommand(".provider use openai");
  await router.handleCommand(".files add /tmp");
  await router.handleCommand(".models use mistral-small");
  await router.handleCommand(".save foo.md");

  assert.deepEqual(calls, [
    ["provider", ["use", "openai"]],
    ["files", ["add", "/tmp"]],
    ["models", ["use", "mistral-small"]],
    ["save", "foo.md"],
  ]);
});

test("command router handles quit and unknown commands", async () => {
  const { context, logs } = createContext();
  const router = createCommandRouter(context, {
    chat: {
      retryLastMessage: async () => {},
      undoLastExchangeCommand: async () => {},
    },
    filesystem: {
      handleFilesCommand: async () => {},
    },
    providers: {
      handleModelsCommand: async () => {},
      handleProviderCommand: async () => {},
      updateModel: async () => {},
      updateTemperature: async () => {},
    },
    session: {
      clearConversation: async () => {},
      loadConversation: async () => {},
      saveConversation: async () => {},
    },
  });

  await router.handleCommand(".quit");
  await router.handleCommand(".not-a-command");

  assert.equal(context.state.shouldExit, true);
  assert.match(logs[0], /unknown command/);
});
