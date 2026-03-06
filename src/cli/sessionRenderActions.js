export function createSessionRenderActions(context) {
  function renderConversationHistory() {
    context.runtime.clearLatexImages();
    process.stdout.write("\x1b[2J\x1b[H");
    context.runtime.printBanner(context.providerRegistry.getActiveName(), context.state.model);
    context.state.hasRenderedView = true;

    context.history.forEach((message) => {
      if (message.role === "user") {
        context.runtime.printUserMessage(context.runtime.getMessageText(message));
        return;
      }

      context.runtime.renderFull(context.runtime.getMessageText(message));
    });
  }

  function renderInitialView() {
    if (context.state.hasRenderedView) return;
    context.runtime.printBanner(context.providerRegistry.getActiveName(), context.state.model);
    context.state.hasRenderedView = true;
  }

  function clearConversation() {
    context.history.length = 0;
    process.stdout.write("\x1b[2J\x1b[H");
    context.runtime.clearLatexImages();
    context.runtime.printBanner(context.providerRegistry.getActiveName(), context.state.model);
  }

  return {
    clearConversation,
    renderConversationHistory,
    renderInitialView,
  };
}
