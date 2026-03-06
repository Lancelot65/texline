import { getMessageText } from "./conversation.js";

function getRetryText(message) {
  if (typeof message?.metadata?.rawInput === "string" && message.metadata.rawInput.trim()) {
    return message.metadata.rawInput;
  }
  return getMessageText(message);
}

function takeTrailingAssistant(history) {
  if (history.at(-1)?.role !== "assistant") return null;
  return history.pop();
}

function takeTrailingUser(history) {
  if (history.at(-1)?.role !== "user") return null;
  return history.pop();
}

export function removeLastExchange(history) {
  const removedAssistant = takeTrailingAssistant(history);
  const removedUser = takeTrailingUser(history);

  if (!removedAssistant && !removedUser) return { removed: false, userText: "" };

  return {
    removed: true,
    userText: removedUser ? getRetryText(removedUser) : "",
  };
}

export function takeRetryMessage(history) {
  const snapshotLength = history.length;
  const { removed, userText } = removeLastExchange(history);
  if (!removed || !userText) {
    history.length = snapshotLength;
    return "";
  }
  return userText;
}
