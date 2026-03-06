import { dim, warn } from "../ui/theme.js";

export function createCommandRouter(context, actions) {
  const handlers = {
    quit: async () => {
      context.state.shouldExit = true;
    },
    exit: async () => {
      context.state.shouldExit = true;
    },
    clear: async () => actions.session.clearConversation(),
    help: async () => context.runtime.printHelp(),
    doctor: async () =>
      context.runtime.runDoctor({
        providerRegistry: context.providerRegistry,
        filesystemRegistry: context.filesystemRegistry,
      }),
    providers: async () => context.runtime.printProvidersList(context.providerRegistry),
    provider: async (args) => actions.providers.handleProviderCommand(args),
    files: async (args) => actions.filesystem?.handleFilesCommand?.(args),
    history: async () => context.runtime.printHistorySummary(context.history),
    undo: async () => actions.chat.undoLastExchangeCommand(),
    retry: async () => actions.chat.retryLastMessage(),
    save: async (_, arg) => actions.session.saveConversation(arg),
    load: async (_, arg) => actions.session.loadConversation(arg),
    model: async (_, arg) => actions.providers.updateModel(arg),
    models: async (args) => actions.providers.handleModelsCommand(args),
    temp: async (_, arg) => actions.providers.updateTemperature(arg),
    system: async () => context.runtime.printSystemPrompt(context.systemPrompt),
  };

  async function handleCommand(input) {
    const [cmd, ...args] = input.slice(1).trim().split(/\s+/);
    const arg = args.join(" ").trim();

    const handler = handlers[cmd];
    if (!handler) {
      context.runtime.console.log(`\n  ${warn("⚠")}  unknown command: ${warn(`.${cmd}`)}  ${dim("(try .help)")}\n`);
      return;
    }

    await handler(args, arg);
  }

  return {
    handleCommand,
  };
}
