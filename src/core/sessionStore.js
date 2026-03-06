import fs from "fs";

import { createAssistantMessage, createUserMessage, getMessageText } from "./conversation.js";

const SESSION_MARKER = "texline-session";

function encodeSessionPayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeSessionPayload(encoded) {
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
}

function normalizeLoadedMessage(entry) {
  const role = entry?.role === "assistant" ? "assistant" : "user";
  const text = String(entry?.text || "");
  if (role === "assistant") {
    const provider = String(entry?.metadata?.provider || "").trim();
    const model = String(entry?.metadata?.model || "").trim();
    const extraMetadata = { ...(entry?.metadata || {}) };
    return createAssistantMessage(text, provider, model, extraMetadata);
  }
  return createUserMessage(text, entry?.metadata || undefined);
}

function buildSessionPayload({ providerName, model, temperature, history }) {
  return {
    version: 1,
    providerName: String(providerName || "").trim(),
    model: String(model || "").trim(),
    temperature: Number.isFinite(temperature) ? temperature : null,
    history: history.map((message) => ({
      role: message.role,
      text: getMessageText(message),
      metadata: message.metadata || undefined,
    })),
  };
}

function buildSessionComment(payload) {
  return `<!-- ${SESSION_MARKER}\n${encodeSessionPayload(payload)}\n-->`;
}

function parseSessionComment(markdown) {
  const match = String(markdown || "").match(new RegExp(`<!--\\s*${SESSION_MARKER}\\s*\\n([\\s\\S]*?)\\n-->`));
  if (!match) return null;

  try {
    const payload = decodeSessionPayload(match[1].trim());
    return {
      providerName: String(payload?.providerName || "").trim(),
      model: String(payload?.model || "").trim(),
      temperature: Number.isFinite(payload?.temperature) ? payload.temperature : null,
      history: Array.isArray(payload?.history) ? payload.history.map(normalizeLoadedMessage) : [],
    };
  } catch {
    throw new Error("invalid saved session payload");
  }
}

function parseSavedMetadata(markdown) {
  const match = String(markdown || "").match(
    /\*\*provider:\*\*\s*(.*?)\s+\|\s+\*\*model:\*\*\s*(.*?)\s+\|\s+\*\*temperature:\*\*\s*(.*?)(?:\n|$)/
  );
  if (!match) return { providerName: "", model: "", temperature: null };

  const [, providerName, model, temperatureRaw] = match;
  const temperature = Number.parseFloat(String(temperatureRaw || "").trim());
  return {
    providerName: String(providerName || "").trim(),
    model: String(model || "").trim(),
    temperature: Number.isFinite(temperature) ? temperature : null,
  };
}

function parseLegacyMarkdown(markdown) {
  const normalized = String(markdown || "").replace(/\r\n/g, "\n");
  const metadata = parseSavedMetadata(normalized);
  const sections = normalized.split(/\n---\n/g).map((section) => section.trim()).filter(Boolean);
  const history = [];

  for (const section of sections.slice(1)) {
    const lines = section.split("\n");
    const speaker = String(lines[0] || "").trim();
    const content = lines.slice(1).join("\n").trimStart();
    if (!speaker || !content) continue;

    if (speaker === "**you**") {
      history.push(createUserMessage(content));
      continue;
    }

    const providerMatch = speaker.match(/^\*\*(.+)\*\*$/);
    const providerName = providerMatch ? providerMatch[1].trim() : metadata.providerName;
    history.push(createAssistantMessage(content, providerName, metadata.model));
  }

  return { ...metadata, history };
}

export function renderConversationMarkdown({ providerName, model, temperature, history }) {
  let markdown = `# texline — ${new Date().toLocaleString()}\n\n`;
  markdown += `**provider:** ${providerName}  |  **model:** ${model}  |  **temperature:** ${temperature}\n\n---\n\n`;
  history.forEach((message) => {
    const speaker =
      message.role === "user"
        ? "**you**"
        : `**${message?.metadata?.provider || providerName}**`;
    markdown += `${speaker}\n\n${getMessageText(message)}\n\n---\n\n`;
  });

  const payload = buildSessionPayload({ providerName, model, temperature, history });
  markdown += `${buildSessionComment(payload)}\n`;
  return markdown;
}

export function loadConversationFile(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const session = parseSessionComment(markdown) || parseLegacyMarkdown(markdown);
  if (!Array.isArray(session.history) || session.history.length === 0) {
    throw new Error("no conversation history found in saved file");
  }
  return session;
}
