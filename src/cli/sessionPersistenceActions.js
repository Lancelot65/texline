import { bold, dim, info } from "../ui/theme.js";
import { logCliError, logCliSuccess, logCliWarn } from "./logging.js";
import { formatPlainModelLabel, normalizeCliValue, setActiveModel, switchProvider } from "./shared.js";

function restoreSessionState(context, session) {
  let restoredProvider = false;
  const savedProviderName = normalizeCliValue(session.providerName);
  if (savedProviderName && context.providerRegistry.getProviders()[savedProviderName]) {
    restoredProvider = switchProvider(context, savedProviderName);
  }

  if (restoredProvider && typeof session.model === "string") {
    setActiveModel(context, session.model);
  }

  if (Number.isFinite(session.temperature)) {
    context.state.temperature = session.temperature;
  }

  return { restoredProvider, savedProviderName };
}

export function createSessionPersistenceActions(context, savedSessionSelectors, renderActions) {
  function saveConversation(fileArg) {
    const filepath = fileArg
      ? context.runtime.resolvePath(fileArg)
      : context.runtime.joinPath(context.historyDir, `texline_${context.runtime.now()}.md`);

    if (context.history.length === 0) {
      logCliWarn(context, "history is empty.");
      return;
    }

    const markdown = context.runtime.renderConversationMarkdown({
      providerName: context.providerRegistry.getActiveName(),
      model: context.state.model,
      temperature: context.state.temperature,
      history: context.history,
    });

    context.runtime.mkdirSync(context.runtime.dirname(filepath), { recursive: true });
    context.runtime.writeFileSync(filepath, markdown, "utf8");
    logCliSuccess(context, `saved → ${info(filepath)}`);
  }

  async function loadConversation(fileArg) {
    let targetFile = fileArg;
    if (!targetFile && context.useInteractiveInput) {
      const selectedFile = await savedSessionSelectors.selectSavedConversation("Load conversation");
      if (!selectedFile) {
        logCliWarn(context, `no saved conversations in ${info(context.historyDir)}`);
        return false;
      }
      targetFile = selectedFile;
    }

    if (!targetFile) {
      logCliError(context, "usage: .load <file>");
      return false;
    }

    try {
      const filepath = context.runtime.resolvePath(targetFile);
      const session = context.runtime.loadConversationFile(filepath);

      context.history.length = 0;
      context.history.push(...session.history);

      const { restoredProvider, savedProviderName } = restoreSessionState(context, session);
      const restoredLabel =
        `${context.providerRegistry.getActiveName()} ${dim("·")} model ${formatPlainModelLabel(context.state.model)}`;
      const note =
        savedProviderName && !restoredProvider
          ? ` ${dim(`(saved provider '${savedProviderName}' not configured locally)`)}`
          : "";

      if (context.useInteractiveInput) {
        renderActions.renderConversationHistory();
      }

      logCliSuccess(
        context,
        `loaded ${bold(String(context.history.length))} messages from ${info(filepath)} ${dim("·")} ${restoredLabel}${note}`
      );
      return true;
    } catch (error) {
      logCliError(context, error.message);
      return false;
    }
  }

  async function initialize(sessionFile = "") {
    if (sessionFile) {
      await loadConversation(sessionFile);
    }
  }

  return {
    initialize,
    loadConversation,
    saveConversation,
  };
}
