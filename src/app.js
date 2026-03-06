import process from "process";
import readline from "readline";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { createProviderRegistry } from "./core/providers.js";
import { createFilesystemRegistry } from "./core/filesystemRegistry.js";
import { createThinkingSpinner } from "./ui/spinner.js";
import { dim, err } from "./ui/theme.js";
import { createAppController } from "./cli/controller.js";
import { promptLine } from "./cli/prompt.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dir, "..");

const PROVIDERS_FILE = resolve(projectDir, ".tui_chat.providers.json");
const FILESYSTEM_FILE = resolve(projectDir, ".tui_chat.filesystem.json");
const HISTORY_DIR = resolve(projectDir, ".history");
const SYSTEM_PROMPT = readFileSync(resolve(projectDir, "system_prompt.txt"), "utf8");

export function isInteractiveSession(stdin = process.stdin, stdout = process.stdout) {
  return !!(stdin?.isTTY && stdout?.isTTY);
}

export async function runApp({ sessionFile = "" } = {}) {
  const filesystemRegistry = createFilesystemRegistry({ filesystemFile: FILESYSTEM_FILE });
  const providerRegistry = createProviderRegistry({ providersFile: PROVIDERS_FILE });
  const useInteractiveInput = isInteractiveSession();
  const controller = createAppController({
    filesystemRegistry,
    providerRegistry,
    historyDir: HISTORY_DIR,
    systemPrompt: SYSTEM_PROMPT,
    useInteractiveInput,
    spinner: createThinkingSpinner(() => providerRegistry.getModel()),
  });

  await controller.initialize(sessionFile);
  controller.renderInitialView();

  if (!useInteractiveInput) {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of rl) {
      const input = String(line || "").trim();
      if (!input) continue;
      await controller.processInput(input);
      if (controller.shouldExit()) break;
    }
    console.log(dim("\n  bye.\n"));
    return 0;
  }

  while (!controller.shouldExit()) {
    let rawInput;
    try {
      rawInput = await promptLine({ filesystemRegistry, cwd: projectDir });
    } catch (error) {
      console.error(error?.message ? `\n  ${err("✗")}  ${error.message}\n` : error);
      break;
    }

    if (rawInput === undefined) break;

    const input = String(rawInput || "").trim();
    if (!input) continue;
    await controller.processInput(input);
  }

  console.log(dim("\n  bye.\n"));
  return 0;
}
