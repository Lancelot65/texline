// latex.js — render LaTeX expressions as Kitty inline images
import { renderTexToPng } from "../core/texRenderer.js";

const CACHE_MAX = 256;
const cache = new Map();

function touchCache(key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function buildRenderCacheKey(expr, mode) {
  return `${mode}\0${expr}`;
}

function getCachedRender(key) {
  const cached = cache.get(key);
  if (!cached) return null;
  touchCache(key, cached);
  return cached;
}

function setCachedRender(key, png) {
  touchCache(key, png);
}

function attemptRender(expr, mode) {
  const png = renderTexToPng(expr, mode);
  return { ok: !!png, png };
}

/**
 * @param {string} expr   - LaTeX expression (no delimiters)
 * @param {"inline"|"block"} mode
 * @returns {boolean} success
 */
export function renderLatex(expr, mode = "block") {
  const key = buildRenderCacheKey(expr, mode);
  const cached = getCachedRender(key);
  if (cached) {
    kittyWrite(cached, mode);
    return true;
  }

  const { ok, png } = attemptRender(expr, mode);
  if (!ok || !png) return false;

  setCachedRender(key, png);
  kittyWrite(png, mode);
  return true;
}

export function clearLatexImages() {
  // Dedicated Kitty delete-graphics action.
  process.stdout.write("\x1b_Ga=d\x1b\\");
}

function kittyWrite(pngBuf, mode) {
  const data = pngBuf.toString("base64");
  const CHUNK = 4096;
  let offset = 0;
  let first  = true;

  // Kitty protocol: z-index so inline images sit on the baseline
  const extra = mode === "inline" ? ",z=-1" : "";

  while (offset < data.length) {
    const slice = data.slice(offset, offset + CHUNK);
    offset += CHUNK;
    const more = offset < data.length ? 1 : 0;
    if (first) {
      process.stdout.write(`\x1b_Ga=T,f=100,m=${more}${extra};${slice}\x1b\\`);
      first = false;
    } else {
      process.stdout.write(`\x1b_Gm=${more};${slice}\x1b\\`);
    }
  }

  // Newline handling is owned by the caller so block and inline rendering
  // don't accidentally double-space the output.
}
