import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { COMMAND_NAMES, getCommandCompletion, getInputCompletion } from "../src/cli/prompt.js";
import { isPromptCancelled, runPromptSafely } from "../src/cli/promptHelpers.js";
import { buildChoiceList, filterSearchChoices } from "../src/cli/searchHelpers.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-prompt-"));
}

test("getCommandCompletion keeps command prefix completion behavior", () => {
  assert.equal(getCommandCompletion(COMMAND_NAMES, ".pro"), ".providers");
  assert.equal(getCommandCompletion(COMMAND_NAMES, ".model"), ".model");
  assert.equal(getCommandCompletion(COMMAND_NAMES, "plain text"), "");
});

test("getInputCompletion completes .files add paths", (t) => {
  const dir = makeTempDir();
  const docsPath = path.join(dir, "docs");
  fs.mkdirSync(docsPath, { recursive: true });
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const completion = getInputCompletion(COMMAND_NAMES, ".files add do", {
    cwd: dir,
    allowedRoots: [],
  });

  assert.equal(completion, `.files add docs${path.sep}`);
});

test("getInputCompletion completes @path inside allowed roots", (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const readmePath = path.join(rootPath, "README.md");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(readmePath, "# hello\n", "utf8");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const completion = getInputCompletion(COMMAND_NAMES, "read @REA", {
    cwd: rootPath,
    allowedRoots: [rootPath],
  });

  assert.equal(completion, "read @README.md");
});

test("getInputCompletion completes bare @ from the current allowed directory", (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const alphaPath = path.join(rootPath, "alpha.txt");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(alphaPath, "hello\n", "utf8");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const completion = getInputCompletion(COMMAND_NAMES, "read @", {
    cwd: rootPath,
    allowedRoots: [rootPath],
  });

  assert.equal(completion, "read @alpha.txt");
});

test("getInputCompletion resolves @ relative to the configured root, not cwd", (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const nestedPath = path.join(rootPath, "nested");
  const alphaPath = path.join(rootPath, "alpha.txt");
  fs.mkdirSync(nestedPath, { recursive: true });
  fs.writeFileSync(alphaPath, "hello\n", "utf8");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const completion = getInputCompletion(COMMAND_NAMES, "read @a", {
    cwd: nestedPath,
    allowedRoots: [rootPath],
  });

  assert.equal(completion, "read @alpha.txt");
});

test("getInputCompletion completes quoted @path with spaces", (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const pdfPath = path.join(rootPath, "design notes.pdf");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(pdfPath, Buffer.from("%PDF-1.7"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const completion = getInputCompletion(COMMAND_NAMES, 'read @"des', {
    cwd: rootPath,
    allowedRoots: [rootPath],
  });

  assert.equal(completion, 'read @"design notes.pdf"');
});

test('getInputCompletion completes bare quoted @" from the current allowed directory', (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const pdfPath = path.join(rootPath, "design notes.pdf");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(pdfPath, Buffer.from("%PDF-1.7"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const completion = getInputCompletion(COMMAND_NAMES, 'read @"', {
    cwd: rootPath,
    allowedRoots: [rootPath],
  });

  assert.equal(completion, 'read @"design notes.pdf"');
});

test("filterSearchChoices matches on name and description", () => {
  const choices = [
    { name: "openai", description: "official provider" },
    { name: "mistral", description: "fast models" },
  ];

  assert.deepEqual(
    filterSearchChoices(choices, "official").map((choice) => choice.name),
    ["openai"]
  );
  assert.deepEqual(
    filterSearchChoices(choices, "mistr").map((choice) => choice.name),
    ["mistral"]
  );
});

test("buildChoiceList de-duplicates repeated values", () => {
  const choices = buildChoiceList(["a", "a", "b"], (value) => ({ value }));
  assert.deepEqual(choices, [{ value: "a" }, { value: "b" }]);
});

test("runPromptSafely returns fallback for prompt cancellation", async () => {
  const value = await runPromptSafely(
    async () => {
      const error = new Error("cancelled");
      error.name = "AbortPromptError";
      throw error;
    },
    null
  );

  assert.equal(value, null);
  assert.equal(isPromptCancelled({ name: "ExitPromptError" }), true);
});

test("runPromptSafely rethrows non-cancellation errors", async () => {
  await assert.rejects(
    () =>
      runPromptSafely(async () => {
        throw new Error("boom");
      }, null),
    /boom/
  );
});
