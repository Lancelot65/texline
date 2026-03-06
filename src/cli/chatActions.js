import { isLikelyNonChatModel } from "../core/chatModels.js";
import { removeLastExchange, takeRetryMessage } from "../core/history.js";
import { dim, err, good, warn } from "../ui/theme.js";

export function createChatActions(context) {
  async function chat(userText) {
    if (!context.state.model) {
      throw new Error("no model configured for the active provider; use .model <name> or .models use <id>");
    }

    if (isLikelyNonChatModel(context.state.model)) {
      throw new Error(
        `model '${context.state.model}' does not look chat-compatible; try .models and pick a chat model`
      );
    }

    const promptPayload = await context.runtime.expandPromptFileReferences(userText, {
      allowedRoots: context.filesystemRegistry.listRoots(),
      cwd: process.cwd(),
      extractBinaryFileText: ({ filePath, buffer }) =>
        context.runtime.extractTextWithMistralOcr({ filePath, buffer }),
    });

    context.history.push(
      context.runtime.createUserMessage(promptPayload.expandedText, {
        rawInput: promptPayload.rawInput,
        attachments: promptPayload.attachments.map((attachment) => ({
          path: attachment.filePath,
          kind: attachment.kind,
          source: attachment.source,
        })),
      })
    );
    if (context.useInteractiveInput) context.spinner.start();

    const providerName = context.providerRegistry.getActiveName();
    const provider = context.providerRegistry.getActive();
    const apiKey = context.providerRegistry.resolveApiKey(provider);
    const messages = await context.runtime.buildModelMessages(context.systemPrompt, context.history);

    try {
      const completion = await context.runtime.generateOpenAICompatibleCompletion({
        provider,
        providerName,
        apiKey,
        model: context.state.model,
        messages,
        temperature: context.state.temperature,
      });
      const responseStats = context.runtime.buildResponseStats({
        text: completion.text,
        usage: completion.usage,
        durationMs: completion.durationMs,
      });
      const assistantMessage = context.runtime.createAssistantMessage(completion.text, providerName, context.state.model, {
        usage: completion.usage,
        durationMs: completion.durationMs,
        tokensPerSecond: responseStats.tokensPerSecond,
        estimatedOutputTokens: responseStats.estimatedOutputTokens,
      });
      const assistantText = context.runtime.getMessageText(assistantMessage);
      if (context.useInteractiveInput) context.spinner.stop();
      context.runtime.renderFull(assistantText);
      if (context.useInteractiveInput) context.runtime.printResponseStats(responseStats);
      context.history.push(assistantMessage);
    } catch (error) {
      if (context.useInteractiveInput) context.spinner.stop();
      throw error;
    }
  }

  function undoLastExchangeCommand() {
    const { removed } = removeLastExchange(context.history);
    if (!removed) {
      context.runtime.console.log(`\n  ${warn("⚠")}  nothing to undo.\n`);
      return;
    }
    context.runtime.console.log(
      `\n  ${good("✓")}  last exchange removed. ${dim(`(${context.history.length} messages remain)\n`)}`
    );
  }

  async function retryLastMessage() {
    const retryText = takeRetryMessage(context.history);
    if (!retryText) {
      context.runtime.console.log(`\n  ${warn("⚠")}  no message to retry.\n`);
      return;
    }

    try {
      await chat(retryText);
    } catch (error) {
      context.runtime.console.error(`\n  ${err("✗")}  ${error.message}\n`);
    }
  }

  return {
    chat,
    retryLastMessage,
    undoLastExchangeCommand,
  };
}
