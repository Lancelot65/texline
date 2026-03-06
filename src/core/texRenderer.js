import fs from "fs";
import os from "os";
import path from "path";
import { execaSync } from "execa";

const COLOR_RGB = [205, 214, 244];
const INLINE_TEX_PT = parseInt(process.env.TUI_CHAT_LATEX_INLINE_PT || "10", 10);
const BLOCK_TEX_PT = parseInt(process.env.TUI_CHAT_LATEX_BLOCK_PT || "10", 10);
const INLINE_DPI = process.env.TUI_CHAT_LATEX_INLINE_DPI || "120";
const BLOCK_DPI = process.env.TUI_CHAT_LATEX_BLOCK_DPI || "165";

function buildTexMath(expr, mode) {
  const color = COLOR_RGB.join(",");
  if (mode === "inline") {
    return `{\\color[RGB]{${color}}$${expr}$}`;
  }

  return [
    "\\[",
    `{\\color[RGB]{${color}}${expr}}`,
    "\\]",
  ].join("\n");
}

function buildTexDocument(expr, mode) {
  const fontSize = mode === "inline" ? INLINE_TEX_PT : BLOCK_TEX_PT;
  return [
    `\\documentclass[${fontSize}pt]{article}`,
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{amsmath,amssymb,mathtools}",
    "\\usepackage{xcolor}",
    "\\pagestyle{empty}",
    "\\begin{document}",
    "\\thispagestyle{empty}",
    buildTexMath(expr, mode),
    "\\end{document}",
    "",
  ].join("\n");
}

function runCommand(command, args, cwd, options = {}) {
  return execaSync(command, args, {
    cwd,
    reject: false,
    encoding: "buffer",
    stripFinalNewline: false,
    timeout: options.timeout ?? 6000,
    maxBuffer: options.maxBuffer ?? 8 * 1024 * 1024,
  });
}

function createTempRenderDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tui_chat_tex_"));
}

function removeTempRenderDir(tempDir) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

function readOutputPng(tempDir) {
  const pngPath = path.join(tempDir, "eq.png");
  if (!fs.existsSync(pngPath)) return null;
  const png = fs.readFileSync(pngPath);
  return png.length > 0 ? png : null;
}

function writeTexSource(tempDir, expr, mode) {
  fs.writeFileSync(path.join(tempDir, "eq.tex"), buildTexDocument(expr, mode), "utf8");
}

function compileLatex(tempDir) {
  return runCommand("latex", ["-interaction=nonstopmode", "-halt-on-error", "eq.tex"], tempDir);
}

function convertDviToPng(tempDir, dpi) {
  return runCommand(
    "dvipng",
    ["-q", "-T", "tight", "-bg", "Transparent", "-D", dpi, "-o", "eq.png", "eq.dvi"],
    tempDir
  );
}

export function renderTexToPng(expr, mode = "block") {
  const tempDir = createTempRenderDir();
  const dpi = mode === "inline" ? INLINE_DPI : BLOCK_DPI;

  try {
    writeTexSource(tempDir, expr, mode);

    const latexResult = compileLatex(tempDir);
    if (latexResult.exitCode !== 0) return null;

    const dvipngResult = convertDviToPng(tempDir, dpi);
    if (dvipngResult.exitCode !== 0) return null;

    return readOutputPng(tempDir);
  } catch {
    return null;
  } finally {
    removeTempRenderDir(tempDir);
  }
}
