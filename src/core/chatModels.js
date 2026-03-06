export function isLikelyNonChatModel(modelId) {
  const normalizedModelId = String(modelId || "").toLowerCase();
  if (!normalizedModelId) return false;

  return [
    "embed",
    "embedding",
    "moderation",
    "rerank",
    "transcribe",
    "transcription",
    "whisper",
    "tts",
    "speech",
    "asr",
    "ocr",
  ].some((fragment) => normalizedModelId.includes(fragment));
}

export function filterChatModelIds(modelIds, currentModel = "") {
  const filteredModelIds = modelIds.filter((modelId) => !isLikelyNonChatModel(modelId));
  if (filteredModelIds.length > 0) return filteredModelIds;
  return modelIds.includes(currentModel) ? [currentModel] : modelIds;
}
