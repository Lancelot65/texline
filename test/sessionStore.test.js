import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createAssistantMessage,
  createUserMessage,
  getMessageText,
} from "../src/core/conversation.js";
import { loadConversationFile, renderConversationMarkdown } from "../src/core/sessionStore.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-test-"));
}

test("session markdown round-trips through embedded payload", (t) => {
  const dir = makeTempDir();
  const filePath = path.join(dir, "session.md");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const history = [
    createUserMessage("hello"),
    createAssistantMessage("world", "openai", "gpt-x", { durationMs: 1000 }),
  ];

  const markdown = renderConversationMarkdown({
    providerName: "openai",
    model: "gpt-x",
    temperature: 0.3,
    history,
  });
  fs.writeFileSync(filePath, markdown, "utf8");

  const loaded = loadConversationFile(filePath);
  assert.equal(loaded.providerName, "openai");
  assert.equal(loaded.model, "gpt-x");
  assert.equal(loaded.temperature, 0.3);
  assert.equal(loaded.history.length, 2);
  assert.equal(loaded.history[0].role, "user");
  assert.equal(getMessageText(loaded.history[0]), "hello");
  assert.equal(loaded.history[1].role, "assistant");
  assert.equal(getMessageText(loaded.history[1]), "world");
  assert.equal(loaded.history[1].metadata.provider, "openai");
  assert.equal(loaded.history[1].metadata.model, "gpt-x");
});

test("session markdown preserves an empty saved model", (t) => {
  const dir = makeTempDir();
  const filePath = path.join(dir, "session-empty-model.md");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const markdown = renderConversationMarkdown({
    providerName: "openai",
    model: "",
    temperature: 0.2,
    history: [createUserMessage("hello")],
  });
  fs.writeFileSync(filePath, markdown, "utf8");

  const loaded = loadConversationFile(filePath);
  assert.equal(loaded.providerName, "openai");
  assert.equal(loaded.model, "");
  assert.equal(loaded.history.length, 1);
});

test("legacy markdown export still loads", (t) => {
  const dir = makeTempDir();
  const filePath = path.join(dir, "legacy.md");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const legacy = [
    "# texline - 1/1/2026, 10:00:00",
    "",
    "**provider:** openai  |  **model:** gpt-old  |  **temperature:** 0.7",
    "",
    "---",
    "",
    "**you**",
    "",
    "hello there",
    "",
    "---",
    "",
    "**openai**",
    "",
    "general kenobi",
    "",
    "---",
    "",
  ].join("\n");

  fs.writeFileSync(filePath, legacy, "utf8");
  const loaded = loadConversationFile(filePath);

  assert.equal(loaded.providerName, "openai");
  assert.equal(loaded.model, "gpt-old");
  assert.equal(loaded.temperature, 0.7);
  assert.equal(loaded.history.length, 2);
  assert.equal(loaded.history[0].role, "user");
  assert.equal(getMessageText(loaded.history[0]), "hello there");
  assert.equal(loaded.history[1].role, "assistant");
  assert.equal(getMessageText(loaded.history[1]), "general kenobi");
});
