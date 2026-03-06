import chalk from "chalk";

import { normalizeModelText } from "../core/messageText.js";
import { renderLatex } from "./latex.js";
import { renderMarkdown } from "./markdown.js";
import { extractMathPlaceholders } from "./mathPlaceholders.js";

const PLACEHOLDER_RE = /(XXBLKXX\d+XXBLKXX|XXILXX\d+XXILXX)/;
const BLOCK_PLACEHOLDER_RE = /^XXBLKXX(\d+)XXBLKXX$/;
const INLINE_PLACEHOLDER_RE = /^XXILXX(\d+)XXILXX$/;

function chalkMath(expr, block) {
  if (block) {
    const line = chalk.hex("#414868")("─".repeat(50));
    return `\n${line}\n${chalk.hex("#e0af68")(`  ${expr}`)}\n${line}\n`;
  }
  return chalk.hex("#e0af68")(expr);
}

function writeBlockMath(expr) {
  process.stdout.write("\n");
  if (!renderLatex(expr, "block")) process.stdout.write(chalkMath(expr, true));
  process.stdout.write("\n");
}

function writeInlineMath(expr) {
  if (!renderLatex(expr, "inline")) process.stdout.write(chalkMath(expr, false));
}

function renderPart(part, items) {
  const blockMatch = part.match(BLOCK_PLACEHOLDER_RE);
  if (blockMatch) {
    const { expr } = items[parseInt(blockMatch[1], 10)];
    writeBlockMath(expr);
    return;
  }

  const inlineMatch = part.match(INLINE_PLACEHOLDER_RE);
  if (inlineMatch) {
    const { expr } = items[parseInt(inlineMatch[1], 10)];
    writeInlineMath(expr);
    return;
  }

  process.stdout.write(part);
}

function renderWithMathPlaceholders(renderedText, items) {
  renderedText.split(PLACEHOLDER_RE).forEach((part) => renderPart(part, items));
}

function normalizeRenderedOutput(text) {
  if (!text) return text;
  return text.replace(/\n+$/, "\n");
}

export { extractMathPlaceholders } from "./mathPlaceholders.js";

export function renderFull(text) {
  const normalized = normalizeModelText(text);
  const { processed, items } = extractMathPlaceholders(normalized);
  const rendered = normalizeRenderedOutput(renderMarkdown(processed));
  renderWithMathPlaceholders(rendered, items);
}
