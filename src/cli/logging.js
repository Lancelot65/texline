import { err, good, info, warn } from "../ui/theme.js";

export function logCliError(context, message) {
  context.runtime.console.log(`\n  ${err("✗")}  ${message}\n`);
}

export function logCliInfo(context, message) {
  context.runtime.console.log(`\n  ${info("●")}  ${message}\n`);
}

export function logCliSuccess(context, message) {
  context.runtime.console.log(`\n  ${good("✓")}  ${message}\n`);
}

export function logCliWarn(context, message) {
  context.runtime.console.log(`\n  ${warn("⚠")}  ${message}\n`);
}
