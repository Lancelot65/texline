import test from "node:test";
import assert from "node:assert/strict";

import {
  getMarkdownRenderCacheSize,
  renderMarkdown,
  resetMarkdownRendererState,
} from "../src/render/markdown.js";
import { extractMathPlaceholders, renderFull } from "../src/render/renderer.js";

function captureStdout(fn) {
  const originalWrite = process.stdout.write.bind(process.stdout);
  let output = "";

  process.stdout.write = (chunk, encoding, callback) => {
    output += typeof chunk === "string" ? chunk : chunk.toString(encoding);
    if (typeof callback === "function") callback();
    return true;
  };

  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

test("renderer keeps raw markdown when glow is disabled", () => {
  process.env.TUI_CHAT_DISABLE_GLOW = "1";
  try {
    const output = captureStdout(() => {
      renderFull("# Title\n\nUse `code` and snake_case.\n");
    });

    assert.equal(output, "# Title\n\nUse `code` and snake_case.");
  } finally {
    delete process.env.TUI_CHAT_DISABLE_GLOW;
  }
});

test("math extraction does not touch markdown code spans or fences", () => {
  const input = [
    "Use `$HOME` before solving $x$.",
    "",
    "```sh",
    "echo $PATH",
    "printf '%s\\n' '$y$'",
    "```",
    "",
    "$$z$$",
  ].join("\n");

  const { processed, items } = extractMathPlaceholders(input);

  assert.match(processed, /`\$HOME`/);
  assert.match(processed, /```sh\necho \$PATH\nprintf '%s\\n' '\$y\$'\n```/);
  assert.equal((processed.match(/XX(?:BLK|IL)XX\d+XX(?:BLK|IL)XX/g) || []).length, 2);
  assert.deepEqual(
    items.map(({ expr, type }) => ({ expr, type })).sort((left, right) => left.expr.localeCompare(right.expr)),
    [
      { expr: "x", type: "inline" },
      { expr: "z", type: "block" },
    ]
  );
});

test("renderMarkdown caches successful glow renders for identical inputs", () => {
  resetMarkdownRendererState();

  let renderCount = 0;
  const options = {
    glowAvailable: true,
    runGlow: (text) => {
      renderCount += 1;
      return `rendered:${text}`;
    },
    style: "dark",
    width: "80",
  };

  const first = renderMarkdown("**hello**", options);
  const second = renderMarkdown("**hello**", options);

  assert.equal(first, "rendered:**hello**");
  assert.equal(second, "rendered:**hello**");
  assert.equal(renderCount, 1);
  assert.equal(getMarkdownRenderCacheSize(), 1);
});

test("renderMarkdown skips caching when glow is unavailable", () => {
  resetMarkdownRendererState();

  const output = renderMarkdown("**hello**", {
    glowAvailable: false,
    runGlow: () => {
      throw new Error("should not run");
    },
  });

  assert.equal(output, "**hello**");
  assert.equal(getMarkdownRenderCacheSize(), 0);
});
