import { HAS_MATH_RE } from "../ui/output.js";
import { err } from "../ui/theme.js";
import { createChatActions } from "./chatActions.js";
import { createCommandRouter } from "./commandRouter.js";
import { createFilesystemActions } from "./filesystemActions.js";
import { createProviderActions } from "./providerActions.js";
import { createDefaultRuntime } from "./runtime.js";
import { createSelectors } from "./selectors.js";
import { createSessionActions } from "./sessionActions.js";

function createEmptyFilesystemRegistry() {
  return {
    listRoots() {
      return [];
    },
  };
}

export function createAppController({
  filesystemRegistry = createEmptyFilesystemRegistry(),
  providerRegistry,
  historyDir,
  systemPrompt,
  useInteractiveInput,
  spinner,
  deps = {},
}) {
  const context = {
    filesystemRegistry,
    providerRegistry,
    historyDir,
    systemPrompt,
    useInteractiveInput,
    spinner,
    runtime: { ...createDefaultRuntime(), ...deps },
    history: [],
    state: {
      temperature: 0.15,
      model: providerRegistry.getModel(),
      shouldExit: false,
      hasRenderedView: false,
    },
  };

  providerRegistry.addKnownModel(providerRegistry.getActiveName(), context.state.model);

  const selectors = createSelectors(context);
  const sessionActions = createSessionActions(context, selectors);
  const providerActions = createProviderActions(context, selectors);
  const filesystemActions = createFilesystemActions(context);
  const chatActions = createChatActions(context);
  const commandRouter = createCommandRouter(context, {
    chat: chatActions,
    filesystem: filesystemActions,
    providers: providerActions,
    session: sessionActions,
  });

  async function processInput(input) {
    if (input.startsWith(".")) {
      await commandRouter.handleCommand(input);
      return;
    }

    if (context.useInteractiveInput && HAS_MATH_RE.test(input)) {
      context.runtime.printUserLine(input);
    }

    try {
      await chatActions.chat(input);
    } catch (error) {
      context.runtime.console.error(`\n  ${err("✗")}  ${error.message}\n`);
    }
  }

  return {
    getHistory: () => context.history,
    initialize: sessionActions.initialize,
    processInput,
    renderInitialView: sessionActions.renderInitialView,
    shouldExit: () => context.state.shouldExit,
  };
}
