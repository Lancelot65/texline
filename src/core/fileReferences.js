import fs from "fs";
import path from "path";

const BINARY_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);
const TEXT_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".conf",
  ".cpp",
  ".css",
  ".csv",
  ".env",
  ".gitignore",
  ".go",
  ".graphql",
  ".h",
  ".hpp",
  ".html",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".log",
  ".lua",
  ".md",
  ".mjs",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const FILE_REFERENCE_RE = /@(?:"([^"\n]+)"|'([^'\n]+)'|([^\s"'`]+))/g;

function normalizeNewlines(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function buildPathNotAllowedError(filePath, roots) {
  const label = roots.length === 1 ? "allowed root" : "allowed roots";
  throw new Error(`path is outside configured read-only ${label}: ${filePath}`);
}

function isPathInsideRoot(candidatePath, rootPath) {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function pickReferenceBaseDirectory(allowedRoots, cwd = process.cwd()) {
  if (allowedRoots.length > 0) return allowedRoots[0];
  return cwd;
}

function resolveAllowedFilePath(rawPath, allowedRoots, cwd = process.cwd()) {
  const sourcePath = String(rawPath || "").trim();
  if (!sourcePath) throw new Error("empty file reference");
  if (allowedRoots.length === 0) throw new Error("no read-only roots configured. Use .files add <path> first.");

  const baseDirectory = pickReferenceBaseDirectory(allowedRoots, cwd);
  const resolvedInput = path.isAbsolute(sourcePath)
    ? sourcePath
    : path.resolve(baseDirectory, sourcePath);
  const matchingRoot = allowedRoots.find((rootPath) => isPathInsideRoot(resolvedInput, rootPath));
  if (!matchingRoot) {
    buildPathNotAllowedError(resolvedInput, allowedRoots);
  }

  if (!fs.existsSync(resolvedInput)) {
    throw new Error(`file not found: ${resolvedInput}`);
  }

  const realFilePath = fs.realpathSync(resolvedInput);
  const allowedRealRoot = allowedRoots.find((rootPath) => isPathInsideRoot(realFilePath, rootPath));
  if (!allowedRealRoot) {
    buildPathNotAllowedError(realFilePath, allowedRoots);
  }

  const stats = fs.statSync(realFilePath);
  if (!stats.isFile()) {
    throw new Error(`not a file: ${realFilePath}`);
  }

  return realFilePath;
}

function isTextBuffer(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte < 32 || byte === 127) return false;
  }
  return true;
}

function detectFileKind(filePath, buffer) {
  const ext = path.extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return "binary";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  return isTextBuffer(buffer) ? "text" : "binary";
}

function formatAttachmentBlock({ filePath, source, kind, content }) {
  const lines = [
    `[attached-file path="${filePath}" kind="${kind}" source="${source}"]`,
    normalizeNewlines(content),
    `[/attached-file]`,
  ];
  return lines.join("\n");
}

export function parseFileReferences(text) {
  const source = String(text || "");
  const references = [];

  for (const match of source.matchAll(FILE_REFERENCE_RE)) {
    const rawPath = match[1] || match[2] || match[3] || "";
    if (!rawPath) continue;
    references.push({
      raw: match[0],
      path: rawPath,
      index: match.index ?? 0,
    });
  }

  return references;
}

export async function expandPromptFileReferences(
  input,
  {
    allowedRoots,
    cwd = process.cwd(),
    extractBinaryFileText,
  }
) {
  const rawInput = String(input || "");
  const references = parseFileReferences(rawInput);
  if (references.length === 0) {
    return {
      rawInput,
      expandedText: rawInput,
      attachments: [],
    };
  }

  const attachments = [];
  for (const reference of references) {
    const filePath = resolveAllowedFilePath(reference.path, allowedRoots, cwd);
    const buffer = fs.readFileSync(filePath);
    const kind = detectFileKind(filePath, buffer);

    if (kind === "text") {
      attachments.push({
        reference,
        filePath,
        kind,
        source: "direct",
        content: normalizeNewlines(buffer.toString("utf8")),
      });
      continue;
    }

    if (typeof extractBinaryFileText !== "function") {
      throw new Error(`binary file requires OCR support: ${filePath}`);
    }

    const content = await extractBinaryFileText({ filePath, buffer });
    attachments.push({
      reference,
      filePath,
      kind,
      source: "ocr",
      content: normalizeNewlines(content),
    });
  }

  const attachmentText = attachments.map(formatAttachmentBlock).join("\n\n");
  return {
    rawInput,
    expandedText: `${rawInput}\n\n${attachmentText}`,
    attachments,
  };
}

export { detectFileKind, resolveAllowedFilePath };
