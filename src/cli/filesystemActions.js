import { bold } from "../ui/theme.js";
import { logCliError, logCliSuccess, logCliWarn } from "./logging.js";

function normalizeCliValue(value) {
  return String(value || "").trim();
}

export function createFilesystemActions(context) {
  function handleFilesCommand(args) {
    const sub = normalizeCliValue(args[0]);
    if (!sub) {
      context.runtime.printFilesystemRoots(context.filesystemRegistry);
      return;
    }

    const rootArg = args.slice(1).join(" ").trim();

    if (sub === "add") {
      if (!rootArg) {
        logCliError(context, "usage: .files add <path>");
        return;
      }

      try {
        const normalizedPath = context.filesystemRegistry.addRoot(rootArg);
        logCliSuccess(context, `read-only root added: ${bold(normalizedPath)}`);
      } catch (error) {
        logCliError(context, error.message);
      }
      return;
    }

    if (sub === "rm" || sub === "remove" || sub === "delete") {
      if (!rootArg) {
        logCliError(context, "usage: .files rm <path>");
        return;
      }

      try {
        const { removed, normalizedPath } = context.filesystemRegistry.removeRoot(rootArg);
        if (!removed) {
          logCliWarn(context, `root not configured: ${normalizedPath}`);
          return;
        }
        logCliSuccess(context, `read-only root removed: ${bold(normalizedPath)}`);
      } catch (error) {
        logCliError(context, error.message);
      }
      return;
    }

    logCliError(context, "usage: .files | .files add <path> | .files rm <path>");
  }

  return {
    handleFilesCommand,
  };
}
