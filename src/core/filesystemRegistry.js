import fs from "fs";
import path from "path";
import Conf from "conf";

function normalizeRootPath(rootPath) {
  const resolvedPath = path.resolve(String(rootPath || "").trim());
  if (!resolvedPath) {
    throw new Error("path is required");
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`path does not exist: ${resolvedPath}`);
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    throw new Error(`path is not a directory: ${resolvedPath}`);
  }

  return fs.realpathSync(resolvedPath);
}

function normalizeConfiguredPath(rootPath) {
  const resolvedPath = path.resolve(String(rootPath || "").trim());
  if (!resolvedPath) {
    throw new Error("path is required");
  }

  return fs.existsSync(resolvedPath) ? fs.realpathSync(resolvedPath) : resolvedPath;
}

function uniqueSortedRoots(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function createFilesystemStore(filesystemFile) {
  const cwd = path.dirname(filesystemFile);
  const configName = path.basename(filesystemFile, path.extname(filesystemFile));
  return new Conf({
    projectName: "tui_chat",
    cwd,
    configName,
    defaults: {
      roots: [],
    },
    serialize: (value) => `${JSON.stringify(value, null, 2)}\n`,
    deserialize: (value) => JSON.parse(value),
  });
}

export function createFilesystemRegistry({ filesystemFile }) {
  const store = createFilesystemStore(filesystemFile);
  let roots = uniqueSortedRoots((store.get("roots") || []).filter((value) => typeof value === "string"));

  function save() {
    store.set("roots", roots);
  }

  function listRoots() {
    return [...roots];
  }

  function addRoot(rootPath) {
    const normalizedPath = normalizeRootPath(rootPath);
    roots = uniqueSortedRoots([...roots, normalizedPath]);
    save();
    return normalizedPath;
  }

  function removeRoot(rootPath) {
    const normalizedPath = normalizeConfiguredPath(rootPath);
    const nextRoots = roots.filter((candidate) => candidate !== normalizedPath);
    const removed = nextRoots.length !== roots.length;
    roots = nextRoots;
    if (removed) save();
    return { removed, normalizedPath };
  }

  save();

  return {
    filesystemFile: store.path,
    listRoots,
    addRoot,
    removeRoot,
  };
}
