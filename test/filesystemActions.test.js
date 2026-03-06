import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createFilesystemActions } from "../src/cli/filesystemActions.js";
import { createFilesystemRegistry } from "../src/core/filesystemRegistry.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-files-actions-"));
}

function createContext(filesystemRegistry) {
  const messages = [];
  return {
    messages,
    context: {
      filesystemRegistry,
      runtime: {
        console: {
          log(value) {
            messages.push(String(value));
          },
        },
        printFilesystemRoots() {},
      },
    },
  };
}

test("files add stores a normalized root", async (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "allowed");
  const filesystemFile = path.join(dir, "filesystem.json");
  fs.mkdirSync(rootPath, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const registry = createFilesystemRegistry({ filesystemFile });
  const { context } = createContext(registry);
  const actions = createFilesystemActions(context);

  await actions.handleFilesCommand(["add", rootPath]);

  assert.deepEqual(registry.listRoots(), [fs.realpathSync(rootPath)]);
});

test("files rm removes an existing root", async (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "allowed");
  const filesystemFile = path.join(dir, "filesystem.json");
  fs.mkdirSync(rootPath, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const registry = createFilesystemRegistry({ filesystemFile });
  registry.addRoot(rootPath);

  const { context } = createContext(registry);
  const actions = createFilesystemActions(context);

  await actions.handleFilesCommand(["rm", rootPath]);

  assert.deepEqual(registry.listRoots(), []);
});

test("files add rejects missing directories", async (t) => {
  const dir = makeTempDir();
  const filesystemFile = path.join(dir, "filesystem.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const registry = createFilesystemRegistry({ filesystemFile });
  const { context, messages } = createContext(registry);
  const actions = createFilesystemActions(context);

  await actions.handleFilesCommand(["add", path.join(dir, "missing")]);

  assert.match(messages[0], /path does not exist/);
  assert.deepEqual(registry.listRoots(), []);
});
