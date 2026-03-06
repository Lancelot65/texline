import chalk from "chalk";

import { renderLatex } from "../render/latex.js";
import { getMessageText } from "../core/conversation.js";
import { COLORS, bold, dim, good, info, warn, width } from "./theme.js";

export const USER_LINE_PREFIX = chalk.bold.hex(COLORS.blue)("> ");
export const PROMPT_TEXT = "> ";

export const PROVIDER_USAGE_LINES = [
  ".provider",
  ".provider <name>",
  ".provider use <name>",
  ".provider add <name> <base_url> <api_key_env> [model]",
  ".provider rm <name>",
];

export const FILES_USAGE_LINES = [
  ".files",
  ".files add <path>",
  ".files rm <path>",
];

const MATH_SPLIT_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^)\n]+?\\\))/g;
export const HAS_MATH_RE = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^)\n]+?\\\)/;

function safeRule(length) {
  return "─".repeat(Math.max(0, length));
}

function estimateTokens(messages) {
  const chars = messages.reduce((total, message) => total + getMessageText(message).length, 0);
  return Math.round(chars / 4);
}

export function estimateTextTokens(text) {
  const normalizedText = String(text || "");
  if (!normalizedText) return 0;
  return Math.max(1, Math.round(normalizedText.length / 4));
}

function formatMetricNumber(value, digits = 1) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

export function buildResponseStats({ text, usage, durationMs }) {
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : null;
  const outputTokens = usage?.outputTokens ?? estimateTextTokens(text);
  const inputTokens = usage?.inputTokens ?? null;
  const totalTokens = usage?.totalTokens ?? (inputTokens !== null ? inputTokens + outputTokens : null);
  const tokensPerSecond = safeDurationMs ? outputTokens / (safeDurationMs / 1000) : null;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs: safeDurationMs,
    tokensPerSecond,
    estimatedOutputTokens: usage?.outputTokens == null,
  };
}

export function printResponseStats(stats) {
  if (!stats) return;

  const parts = [];
  if (stats.inputTokens !== null) parts.push(`${formatMetricNumber(stats.inputTokens, 0)} in`);
  parts.push(`${stats.estimatedOutputTokens ? "~" : ""}${formatMetricNumber(stats.outputTokens, 0)} out`);
  if (stats.totalTokens !== null) parts.push(`${formatMetricNumber(stats.totalTokens, 0)} total`);
  if (stats.tokensPerSecond !== null) parts.push(`${formatMetricNumber(stats.tokensPerSecond)} tok/s`);
  if (stats.durationMs !== null) parts.push(`${formatMetricNumber(stats.durationMs / 1000)}s`);

  console.log(`\n  ${info("●")}  ${dim(parts.join(` ${dim("·")} `))}\n`);
}

function clearEchoedInput(input) {
  const columns = Math.max(1, width());
  const visualChars = PROMPT_TEXT.length + input.length;
  const rows = Math.max(1, Math.ceil(visualChars / columns));

  process.stdout.write("\x1b[1A");
  for (let row = 0; row < rows; row++) {
    process.stdout.write("\x1b[2K\r");
    if (row < rows - 1) process.stdout.write("\x1b[1A");
  }
}

export function printBanner(providerName, model) {
  const line = safeRule(width());
  const modelLabel = model ? chalk.hex(COLORS.green)(model) : dim("(no model)");
  console.log();
  console.log(chalk.hex(COLORS.border)("╭" + line.slice(1)));
  console.log(
    chalk.hex(COLORS.border)("│ ") +
      chalk.bold.hex(COLORS.blue)("texline") +
      chalk.hex(COLORS.border)("  ·  ") +
      chalk.hex(COLORS.cyan)(providerName) +
      chalk.hex(COLORS.border)(":") +
      modelLabel
  );
  console.log(chalk.hex(COLORS.border)("│ ") + dim("ready when you are"));
  console.log(
    chalk.hex(COLORS.border)("│ ") +
      dim("type ") +
      chalk.hex(COLORS.purple)(".help") +
      dim(" for help")
  );
  console.log(chalk.hex(COLORS.border)("╰" + line.slice(1)));
  console.log();
}

export function printHelp() {
  const pad = (value, maxLen) => value + " ".repeat(Math.max(0, maxLen - value.length));
  const commands = [
    [".help", "show this message"],
    [".doctor", "check runtime dependencies, OCR key, and LaTeX backend"],
    [".providers", "list configured providers"],
    [".provider ...", "show/switch/add/remove openai-compatible providers"],
    [".files ...", "show/add/remove read-only file roots for @path"],
    [".clear", "reset conversation history"],
    [".history", "show messages in context + token estimate"],
    [".undo", "remove last exchange (your msg + reply)"],
    [".retry", "resend your last message"],
    [".save [file]", "save conversation to reloadable markdown"],
    [".load <file>", "restore a saved conversation"],
    [".model [name]", "show or set model for active provider"],
    [".models", "list provider models (.models refresh / .models use <id>)"],
    [".temp [0–1]", "show or set temperature"],
    [".system", "display the current system prompt"],
    [".quit / .exit", "exit texline"],
  ];

  console.log();
  console.log(
    chalk.hex(COLORS.border)("┌─ ") +
      bold("commands") +
      chalk.hex(COLORS.border)(" " + safeRule(width() - 12))
  );
  for (const [command, description] of commands) {
    console.log(
      chalk.hex(COLORS.border)("│  ") +
        chalk.hex(COLORS.purple)(pad(command, 18)) +
        chalk.hex(COLORS.dim)(description)
    );
  }
  console.log(chalk.hex(COLORS.border)("└" + safeRule(width() - 1)));
  console.log();
}

export function printUserMessage(text, { clearPrompt = false } = {}) {
  if (clearPrompt) clearEchoedInput(text);
  process.stdout.write(USER_LINE_PREFIX);
  const parts = text.split(MATH_SPLIT_RE);

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (!part) continue;
    if (index % 2 === 1) {
      const isBlock = part.startsWith("$$") || part.startsWith("\\[");
      let expression = "";
      if (part.startsWith("$$")) expression = part.slice(2, -2).trim();
      else if (part.startsWith("\\[")) expression = part.slice(2, -2).trim();
      else if (part.startsWith("\\(")) expression = part.slice(2, -2).trim();
      else expression = part.slice(1, -1).trim();

      const ok = renderLatex(expression, isBlock ? "block" : "inline");
      if (!ok) process.stdout.write(chalk.hex(COLORS.yellow)(part));
      continue;
    }
    process.stdout.write(part);
  }
  process.stdout.write("\n");
}

export function printUserLine(text) {
  printUserMessage(text, { clearPrompt: true });
}

export function printProvidersList(providerRegistry) {
  console.log();
  console.log(chalk.hex(COLORS.border)("┌─ ") + bold("providers"));
  for (const [name, provider] of Object.entries(providerRegistry.getProviders())) {
    const isActive = name === providerRegistry.getActiveName();
    const marker = isActive ? good("●") : dim("○");
    const missingKeyLabel = provider.apiKeyEnv ? `missing ${provider.apiKeyEnv}` : "missing apiKeyEnv";
    const keyStatus = providerRegistry.resolveApiKey(provider)
      ? good("key ok")
      : warn(missingKeyLabel);
    const modelName = provider.model || dim("(no model)");
    console.log(
      `${chalk.hex(COLORS.border)("│ ")}${marker} ` +
        `${chalk.hex(COLORS.cyan)(name)} ${dim("·")} ${chalk.hex(COLORS.green)(modelName)} ${dim("·")} ` +
        `${dim(provider.baseURL)} ${dim("·")} ${keyStatus}`
    );
  }
  console.log(chalk.hex(COLORS.border)("└"));
  console.log();
}

export function printProviderDetails(providerRegistry) {
  const provider = providerRegistry.getActive();
  const modelLabel = provider?.model ? provider.model : dim("(no model)");
  console.log();
  console.log(`  ${info("●")} active provider: ${bold(providerRegistry.getActiveName())}`);
  if (provider) {
    const missingKeyLabel = provider.apiKeyEnv ? `missing env ${provider.apiKeyEnv}` : "missing apiKeyEnv";
    const keyStatus = providerRegistry.resolveApiKey(provider)
      ? good("key resolved")
      : warn(missingKeyLabel);
    console.log(`  ${dim("baseURL:")} ${provider.baseURL}`);
    console.log(`  ${dim("model:")} ${modelLabel}`);
    console.log(`  ${dim("apiKeyEnv:")} ${provider.apiKeyEnv} ${dim("·")} ${keyStatus}`);
  }
  console.log(`\n  ${dim("usage:")}`);
  PROVIDER_USAGE_LINES.forEach((line) => {
    console.log(`  ${chalk.hex(COLORS.purple)(line)}`);
  });
  console.log();
}

export function printHistorySummary(history) {
  const messageCount = history.length;
  const estimatedTokens = estimateTokens(history);
  const exchanges = Math.floor(messageCount / 2);
  console.log();
  console.log(
    `  ${info("●")} ${bold(String(messageCount))} messages  ${dim("·")}  ` +
      `${bold(String(exchanges))} exchanges  ${dim("·")}  ` +
      `~${bold(String(estimatedTokens))} tokens`
  );
  console.log();
}

export function printFilesystemRoots(filesystemRegistry) {
  const roots = filesystemRegistry.listRoots();

  console.log();
  console.log(`  ${info("●")} read-only file roots: ${bold(String(roots.length))}`);
  if (roots.length === 0) {
    console.log(`  ${dim("usage:")}`);
    FILES_USAGE_LINES.forEach((line) => {
      console.log(`  ${chalk.hex(COLORS.purple)(line)}`);
    });
    console.log();
    return;
  }

  roots.forEach((rootPath) => {
    console.log(`  ${dim("·")} ${rootPath}`);
  });
  console.log(`\n  ${dim("usage:")}`);
  FILES_USAGE_LINES.forEach((line) => {
    console.log(`  ${chalk.hex(COLORS.purple)(line)}`);
  });
  console.log();
}

export function printSystemPrompt(systemPrompt) {
  console.log();
  console.log(chalk.hex(COLORS.border)("┌─ ") + bold("system prompt"));
  systemPrompt.split("\n").forEach((line) => {
    console.log(chalk.hex(COLORS.border)("│ ") + dim(line));
  });
  console.log(chalk.hex(COLORS.border)("└"));
  console.log();
}

export function printModels(providerName, modelIds, currentModel) {
  console.log();
  console.log(chalk.hex(COLORS.border)("┌─ ") + bold(`models (${providerName})`));
  modelIds.forEach((modelId) => {
    const marker = modelId === currentModel ? good("●") : dim("○");
    const currentTag = modelId === currentModel ? ` ${dim("· current")}` : "";
    console.log(`${chalk.hex(COLORS.border)("│ ")}${marker} ${chalk.hex(COLORS.green)(modelId)}${currentTag}`);
  });
  console.log(chalk.hex(COLORS.border)("└"));
  console.log(`\n  ${dim("use")} .models use <model_id> ${dim("or")} .model <model_id>\n`);
}
