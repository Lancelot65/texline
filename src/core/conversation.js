import { convertToModelMessages, pruneMessages } from "ai";

function createTextParts(text) {
  return [{ type: "text", text: String(text || "") }];
}

function createMessage(role, text, metadata = undefined) {
  const message = {
    id: crypto.randomUUID(),
    role,
    parts: createTextParts(text),
  };

  if (metadata) message.metadata = metadata;
  return message;
}

export function createUserMessage(text, metadata = undefined) {
  return createMessage("user", text, metadata);
}

export function createAssistantMessage(text, providerName, model, metadata = undefined) {
  return createMessage("assistant", text, { provider: providerName, model, ...(metadata || {}) });
}

export function createSystemMessage(text) {
  return createMessage("system", text);
}

export function getMessageText(message) {
  if (!message?.parts) return "";
  return message.parts
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join("");
}

export function getAssistantMetadata(message) {
  if (message?.role !== "assistant") return null;
  return message?.metadata || null;
}

export async function buildModelMessages(systemPrompt, history) {
  const messages = [createSystemMessage(systemPrompt), ...history];
  const modelMessages = await convertToModelMessages(messages);
  return pruneMessages({
    messages: modelMessages,
    emptyMessages: "remove",
  });
}
