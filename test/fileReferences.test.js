import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  expandPromptFileReferences,
  parseFileReferences,
  resolveAllowedFilePath,
} from "../src/core/fileReferences.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-files-"));
}

test("parseFileReferences supports bare and quoted paths", () => {
  const references = parseFileReferences(`read @src/app.js and @"docs/file name.pdf" then @'images/a b.png'`);

  assert.deepEqual(
    references.map((reference) => reference.path),
    ["src/app.js", "docs/file name.pdf", "images/a b.png"]
  );
});

test("resolveAllowedFilePath rejects paths outside configured roots", (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const otherPath = path.join(dir, "other.txt");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(otherPath, "outside", "utf8");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  assert.throws(
    () => resolveAllowedFilePath(otherPath, [rootPath], dir),
    /outside configured read-only/
  );
});

test("expandPromptFileReferences appends direct text content", async (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const filePath = path.join(rootPath, "note.txt");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(filePath, "hello\nworld\n", "utf8");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const result = await expandPromptFileReferences("read @note.txt", {
    allowedRoots: [rootPath],
    cwd: rootPath,
  });

  assert.equal(result.rawInput, "read @note.txt");
  assert.match(result.expandedText, /\[attached-file path=".*note\.txt" kind="text" source="direct"\]/);
  assert.match(result.expandedText, /hello\nworld/);
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].source, "direct");
});

test("expandPromptFileReferences resolves relative paths from the configured root, not cwd", async (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const nestedPath = path.join(rootPath, "nested");
  const filePath = path.join(rootPath, "note.txt");
  fs.mkdirSync(nestedPath, { recursive: true });
  fs.writeFileSync(filePath, "hello\nworld\n", "utf8");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const result = await expandPromptFileReferences("read @note.txt", {
    allowedRoots: [rootPath],
    cwd: nestedPath,
  });

  assert.match(result.expandedText, /hello\nworld/);
  assert.equal(result.attachments[0].filePath, filePath);
});

test("expandPromptFileReferences routes binary files to OCR extraction", async (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const filePath = path.join(rootPath, "scan.pdf");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from("%PDF-1.7 fake"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const result = await expandPromptFileReferences("read @scan.pdf", {
    allowedRoots: [rootPath],
    cwd: rootPath,
    extractBinaryFileText: async ({ filePath: currentPath }) => `OCR:${path.basename(currentPath)}`,
  });

  assert.match(result.expandedText, /source="ocr"/);
  assert.match(result.expandedText, /OCR:scan\.pdf/);
  assert.equal(result.attachments[0].kind, "binary");
});

test("expandPromptFileReferences fails when OCR is required but unavailable", async (t) => {
  const dir = makeTempDir();
  const rootPath = path.join(dir, "root");
  const filePath = path.join(rootPath, "scan.png");
  fs.mkdirSync(rootPath, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from([0, 1, 2, 3]));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await assert.rejects(
    () =>
      expandPromptFileReferences("read @scan.png", {
        allowedRoots: [rootPath],
        cwd: rootPath,
      }),
    /requires OCR support/
  );
});
