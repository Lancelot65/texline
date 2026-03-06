import { BLOCK_ENV_GROUP } from "../core/messageText.js";

const BLOCK_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
const BLOCK_ENV_RE = new RegExp(
  `(?:\\\\)?begin\\{(${BLOCK_ENV_GROUP})\\}[\\s\\S]*?(?:\\\\)?end\\{\\1\\}`,
  "g"
);
const INLINE_RE = /\$([^$\n]+?)\$|\\\(([^)\n]+?)\\\)/g;

function addPlaceholder(items, type, expr) {
  const cleanExpr = String(expr || "").trim();
  if (!cleanExpr) return "";
  const idx = items.length;
  items.push({ type, expr: cleanExpr });
  return type === "block"
    ? `\n\nXXBLKXX${idx}XXBLKXX\n\n`
    : `XXILXX${idx}XXILXX`;
}

function normalizeMathEnvironment(expr) {
  return String(expr || "")
    .replace(/(^|\n)([ \t]*)begin\{/g, "$1$2\\\\begin{")
    .replace(/(^|\n)([ \t]*)end\{/g, "$1$2\\\\end{");
}

function countRepeatedChars(text, index, char) {
  let count = 0;
  while (text[index + count] === char) count += 1;
  return count;
}

function findLineEnd(text, index) {
  const lineEnd = text.indexOf("\n", index);
  return lineEnd === -1 ? text.length : lineEnd;
}

function findFenceEnd(text, searchStart, markerChar, markerLength) {
  let cursor = searchStart;

  while (cursor < text.length) {
    const lineEnd = findLineEnd(text, cursor);
    const line = text.slice(cursor, lineEnd);
    const trimmed = line.trimEnd();

    if (new RegExp(`^[ \\t]{0,3}${markerChar}{${markerLength},}$`).test(trimmed)) {
      return lineEnd < text.length ? lineEnd + 1 : lineEnd;
    }

    cursor = lineEnd < text.length ? lineEnd + 1 : text.length;
  }

  return text.length;
}

function protectMarkdownCode(text) {
  const items = [];
  let protectedText = "";
  let index = 0;

  function addCodePlaceholder(segment) {
    const placeholder = `XXCODXX${items.length}XXCODXX`;
    items.push(segment);
    return placeholder;
  }

  while (index < text.length) {
    const lineStart = text.lastIndexOf("\n", index - 1) + 1;
    const linePrefix = text.slice(lineStart, index);
    const char = text[index];

    if (/^[ \t]{0,3}$/.test(linePrefix) && (char === "`" || char === "~")) {
      const fenceLength = countRepeatedChars(text, index, char);
      if (fenceLength >= 3) {
        const lineEnd = findLineEnd(text, index);
        const fenceEnd = findFenceEnd(text, lineEnd < text.length ? lineEnd + 1 : lineEnd, char, fenceLength);
        protectedText += addCodePlaceholder(text.slice(lineStart, fenceEnd));
        index = fenceEnd;
        continue;
      }
    }

    if (char === "`") {
      const tickCount = countRepeatedChars(text, index, "`");
      const delimiter = "`".repeat(tickCount);
      const closingIndex = text.indexOf(delimiter, index + tickCount);

      if (closingIndex !== -1) {
        const codeSpanEnd = closingIndex + tickCount;
        protectedText += addCodePlaceholder(text.slice(index, codeSpanEnd));
        index = codeSpanEnd;
        continue;
      }
    }

    protectedText += char;
    index += 1;
  }

  return { protectedText, items };
}

function restoreMarkdownCode(text, items) {
  return text.replace(/XXCODXX(\d+)XXCODXX/g, (_, rawIndex) => items[parseInt(rawIndex, 10)] || "");
}

export function extractMathPlaceholders(text) {
  const items = [];
  const { protectedText, items: codeItems } = protectMarkdownCode(text);
  let processed = protectedText.replace(BLOCK_RE, (_, exprA, exprB) =>
    addPlaceholder(items, "block", exprA ?? exprB ?? "")
  );
  processed = processed.replace(BLOCK_ENV_RE, (full) =>
    addPlaceholder(items, "block", normalizeMathEnvironment(full))
  );
  processed = processed.replace(INLINE_RE, (_, exprA, exprB) =>
    addPlaceholder(items, "inline", exprA ?? exprB ?? "")
  );
  return { processed: restoreMarkdownCode(processed, codeItems), items };
}
