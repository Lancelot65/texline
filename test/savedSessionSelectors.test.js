import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { listSavedConversationFiles } from "../src/cli/savedSessionSelectors.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-saved-sessions-"));
}

test("listSavedConversationFiles filters markdown files and sorts newest first", (t) => {
  const dir = makeTempDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const older = path.join(dir, "older.md");
  const newer = path.join(dir, "newer.md");
  const ignored = path.join(dir, "ignored.txt");

  fs.writeFileSync(older, "old", "utf8");
  fs.writeFileSync(newer, "new", "utf8");
  fs.writeFileSync(ignored, "ignore", "utf8");

  const past = new Date("2026-03-05T10:00:00Z");
  const future = new Date("2026-03-05T11:00:00Z");
  fs.utimesSync(older, past, past);
  fs.utimesSync(newer, future, future);

  const files = listSavedConversationFiles(dir);

  assert.deepEqual(
    files.map((entry) => entry.name),
    ["newer.md", "older.md"]
  );
});
