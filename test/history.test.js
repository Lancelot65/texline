import test from "node:test";
import assert from "node:assert/strict";

import { createAssistantMessage, createUserMessage } from "../src/core/conversation.js";
import { removeLastExchange, takeRetryMessage } from "../src/core/history.js";

test("removeLastExchange removes a completed exchange", () => {
  const history = [
    createUserMessage("first"),
    createAssistantMessage("reply", "openai", "gpt-4o-mini"),
  ];

  const result = removeLastExchange(history);

  assert.equal(result.removed, true);
  assert.equal(result.userText, "first");
  assert.equal(history.length, 0);
});

test("removeLastExchange removes a trailing user draft without touching older history", () => {
  const history = [
    createUserMessage("first"),
    createAssistantMessage("reply", "openai", "gpt-4o-mini"),
    createUserMessage("draft"),
  ];

  const result = removeLastExchange(history);

  assert.equal(result.removed, true);
  assert.equal(result.userText, "draft");
  assert.equal(history.length, 2);
});

test("takeRetryMessage returns the last user message and trims the trailing exchange", () => {
  const history = [
    createUserMessage("first"),
    createAssistantMessage("reply", "openai", "gpt-4o-mini"),
  ];

  const retryText = takeRetryMessage(history);

  assert.equal(retryText, "first");
  assert.equal(history.length, 0);
});

test("takeRetryMessage prefers the original raw input when user content was expanded", () => {
  const history = [
    createUserMessage("read @notes.txt\n\n[attached-file ...]", { rawInput: "read @notes.txt" }),
    createAssistantMessage("reply", "openai", "gpt-4o-mini"),
  ];

  const retryText = takeRetryMessage(history);

  assert.equal(retryText, "read @notes.txt");
  assert.equal(history.length, 0);
});

test("takeRetryMessage preserves history when nothing retryable exists", () => {
  const history = [createAssistantMessage("orphan", "openai", "gpt-4o-mini")];

  const retryText = takeRetryMessage(history);

  assert.equal(retryText, "");
  assert.equal(history.length, 1);
});
