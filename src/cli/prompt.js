import Enquirer from "enquirer";
import search from "@inquirer/search";
import fs from "fs";
import path from "path";

import { USER_LINE_PREFIX } from "../ui/output.js";
import { runPromptSafely } from "./promptHelpers.js";
import { buildChoiceList, filterSearchChoices } from "./searchHelpers.js";

const { Input: BaseInput } = Enquirer;

export const COMMAND_NAMES = [
  "help",
  "doctor",
  "providers",
  "provider",
  "files",
  "clear",
  "history",
  "undo",
  "retry",
  "save",
  "load",
  "model",
  "models",
  "temp",
  "system",
  "quit",
  "exit",
];

export function getCommandCompletion(commandNames, input = "") {
  const source = String(input || "");
  const match = source.match(/^\.([^\s]*)$/);
  if (!match) return "";

  const needle = match[1].toLowerCase();
  const completion = commandNames.find((commandName) => commandName.startsWith(needle));
  return completion ? `.${completion}` : "";
}

function replaceInputRange(input, start, end, value) {
  return `${input.slice(0, start)}${value}${input.slice(end)}`;
}

function isPathInsideRoot(candidatePath, rootPath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function pickDefaultDirectory({ cwd, allowedRoots }) {
  if (allowedRoots && allowedRoots.length > 0) {
    return allowedRoots[0];
  }

  return cwd;
}

function listPathCandidates(pathFragment = "", { cwd = process.cwd(), allowedRoots = null } = {}) {
  const source = String(pathFragment || "");
  const usesHome = source.startsWith("~/");
  const expandedSource = usesHome ? path.join(process.env.HOME || "", source.slice(2)) : source;
  const defaultDirectory = pickDefaultDirectory({ cwd, allowedRoots });
  const completionBaseDirectory = defaultDirectory;
  const isEmptySource = expandedSource === "";
  const resolvedSource = path.isAbsolute(expandedSource)
    ? expandedSource
    : path.resolve(defaultDirectory, expandedSource);
  const hasTrailingSeparator = /[\\/]$/.test(expandedSource);
  const directoryPath = isEmptySource ? defaultDirectory : hasTrailingSeparator ? resolvedSource : path.dirname(resolvedSource);
  const fragmentName = isEmptySource ? "" : hasTrailingSeparator ? "" : path.basename(expandedSource);

  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    return [];
  }

  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.name.toLowerCase().startsWith(fragmentName.toLowerCase()))
    .sort((left, right) => left.name.localeCompare(right.name));

  return entries
    .map((entry) => {
      const absolutePath = path.join(directoryPath, entry.name);
      if (allowedRoots && !allowedRoots.some((rootPath) => isPathInsideRoot(absolutePath, rootPath))) {
        return null;
      }

      let completionPath = path.isAbsolute(expandedSource)
        ? absolutePath
        : path.relative(completionBaseDirectory, absolutePath) || ".";
      if (usesHome && absolutePath.startsWith(`${process.env.HOME || ""}${path.sep}`)) {
        completionPath = `~/${path.relative(process.env.HOME || "", absolutePath)}`;
      }
      if (entry.isDirectory()) completionPath += path.sep;
      return completionPath;
    })
    .filter(Boolean);
}

function getFilesCommandCompletion(input = "", { cwd = process.cwd() } = {}) {
  const match = String(input || "").match(/^\.files\s+(add|rm|remove|delete)\s+(.+)$/);
  if (!match) return "";

  const [, subcommand, pathFragment] = match;
  const candidates = listPathCandidates(pathFragment, { cwd });
  if (candidates.length === 0) return "";
  return `.files ${subcommand} ${candidates[0]}`;
}

function getAtReferenceContext(input = "", cursor = String(input || "").length) {
  const prefix = String(input || "").slice(0, cursor);

  let match = prefix.match(/@\"([^"\n]*)$/);
  if (match) {
    return {
      quote: "\"",
      pathFragment: match[1],
      start: cursor - match[0].length,
      end: cursor,
    };
  }

  match = prefix.match(/@'([^'\n]*)$/);
  if (match) {
    return {
      quote: "'",
      pathFragment: match[1],
      start: cursor - match[0].length,
      end: cursor,
    };
  }

  match = prefix.match(/@([^\s"'`]*)$/);
  if (match) {
    return {
      quote: "",
      pathFragment: match[1],
      start: cursor - match[0].length,
      end: cursor,
    };
  }

  return null;
}

function getAtPathCompletion(input = "", { cursor = String(input || "").length, cwd = process.cwd(), allowedRoots = [] } = {}) {
  if (allowedRoots.length === 0) return "";

  const reference = getAtReferenceContext(input, cursor);
  if (!reference) return "";

  const candidates = listPathCandidates(reference.pathFragment, { cwd, allowedRoots });
  if (candidates.length === 0) return "";

  const wrappedValue = reference.quote
    ? `@${reference.quote}${candidates[0]}${reference.quote}`
    : `@${candidates[0]}`;

  return replaceInputRange(String(input || ""), reference.start, reference.end, wrappedValue);
}

export function getInputCompletion(commandNames, input = "", options = {}) {
  return (
    getCommandCompletion(commandNames, input) ||
    getFilesCommandCompletion(input, options) ||
    getAtPathCompletion(input, options) ||
    ""
  );
}

class CommandInput extends BaseInput {
  constructor(options = {}) {
    super(options);
    this.commandNames = options.commandNames || [];
    this.cwd = options.cwd || process.cwd();
    this.filesystemRegistry = options.filesystemRegistry || null;
  }

  start() {
    super.start();
    if (!this.stop) return;

    const rawStop = this.stop;
    const safeStop = () => {
      if (safeStop.called) return;
      safeStop.called = true;

      try {
        rawStop();
      } catch (error) {
        if (error?.code !== "ERR_USE_AFTER_CLOSE") throw error;
      }
    };

    this.off("close", rawStop);
    this.once("close", safeStop);
    this.stop = safeStop;
  }

  getCommandCompletion(input = this.input) {
    return getInputCompletion(this.commandNames, input, {
      cursor: this.cursor,
      cwd: this.cwd,
      allowedRoots: this.filesystemRegistry?.listRoots?.() || [],
    });
  }

  tab() {
    const completion = this.getCommandCompletion(this.input);
    if (!completion || completion === this.input) return this.alert();

    this.input = completion;
    this.cursor = completion.length;
    this.initial = completion;
    return this.render();
  }

  async render() {
    this.initial = this.getCommandCompletion(this.input);
    return super.render();
  }
}

export async function promptLine({ filesystemRegistry = null, cwd = process.cwd() } = {}) {
  const prompt = new CommandInput({
    name: "input",
    prefix: USER_LINE_PREFIX.replace("> ", ">"),
    message: () => "",
    separator: () => "",
    commandNames: COMMAND_NAMES,
    filesystemRegistry,
    cwd,
    styles: {
      submitted: (value) => value,
    },
  });

  return runPromptSafely(() => prompt.run(), undefined);
}

export async function selectWithSearch({ message, choices, defaultValue }) {
  if (choices.length === 0) return null;

  return runPromptSafely(
    () =>
      search({
        message,
        pageSize: 10,
        default: defaultValue,
        theme: {
          style: {
            keysHelpTip: () => undefined,
          },
        },
        source: async (term) => filterSearchChoices(choices, term),
      }),
    null
  );
}

export { buildChoiceList };
