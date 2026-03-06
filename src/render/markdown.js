import { spawnSync } from "child_process";

const STRIP_ANSI_RE = /\x1b\[[0-9;]*m/g;
const TERM_WIDTH_MAX = 120;
const GLOW_PROBE_TIMEOUT_MS = 1200;
const GLOW_RENDER_TIMEOUT_MS = 5000;
const MARKDOWN_CACHE_MAX = 64;

let hasWorkingGlowCache = null;
const markdownRenderCache = new Map();

function touchMarkdownCache(key, value) {
  if (markdownRenderCache.has(key)) markdownRenderCache.delete(key);
  markdownRenderCache.set(key, value);
  if (markdownRenderCache.size > MARKDOWN_CACHE_MAX) {
    const oldest = markdownRenderCache.keys().next().value;
    markdownRenderCache.delete(oldest);
  }
}

function getCachedMarkdown(key) {
  const cached = markdownRenderCache.get(key);
  if (!cached) return null;
  touchMarkdownCache(key, cached);
  return cached;
}

function setCachedMarkdown(key, value) {
  touchMarkdownCache(key, value);
}

function getGlowStyle() {
  return process.env.TUI_CHAT_GLOW_STYLE || "dark";
}

function getRenderWidth() {
  return String(Math.min(process.stdout.columns || 80, TERM_WIDTH_MAX));
}

function runGlow(commandText, { style, width }) {
  const result = spawnSync("glow", ["-s", style, "-w", width, "-"], {
    input: commandText,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: GLOW_RENDER_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });

  if (result.error || result.status !== 0 || !result.stdout) return null;
  return result.stdout;
}

function probeGlow(style) {
  if (process.env.TUI_CHAT_DISABLE_GLOW === "1") return false;

  const probeInput = "# t\n\n**b**\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
  const probe = spawnSync("glow", ["-s", style, "-w", "80", "-"], {
    input: probeInput,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: GLOW_PROBE_TIMEOUT_MS,
    killSignal: "SIGKILL",
  });

  if (probe.error || probe.status !== 0 || !probe.stdout) return false;

  const plain = probe.stdout.replace(STRIP_ANSI_RE, "");
  return !plain.includes("**b**") && !plain.includes("|---|---|");
}

function hasWorkingGlow() {
  if (hasWorkingGlowCache !== null) return hasWorkingGlowCache;
  hasWorkingGlowCache = probeGlow(getGlowStyle());
  return hasWorkingGlowCache;
}

function buildMarkdownCacheKey(text, width, style) {
  return `${style}\0${width}\0${text}`;
}

export function resetMarkdownRendererState() {
  hasWorkingGlowCache = null;
  markdownRenderCache.clear();
}

export function getMarkdownRenderCacheSize() {
  return markdownRenderCache.size;
}

export function renderMarkdown(text, options = {}) {
  const source = String(text || "");
  const style = options.style || getGlowStyle();
  const width = options.width || getRenderWidth();
  const glowAvailable = options.glowAvailable ?? hasWorkingGlow();
  const glowRenderer = options.runGlow || ((value) => runGlow(value, { style, width }));

  if (!source.trim() || !glowAvailable) return source;

  const key = buildMarkdownCacheKey(source, width, style);
  const cached = getCachedMarkdown(key);
  if (cached !== null) return cached;

  const rendered = glowRenderer(source);
  if (rendered === null) return source;

  setCachedMarkdown(key, rendered);
  return rendered;
}
