import fs from "fs";
import path from "path";

import { clearLatexImages } from "../render/latex.js";
import { renderFull } from "../render/renderer.js";
import {
  buildModelMessages,
  createAssistantMessage,
  createUserMessage,
  getMessageText,
} from "../core/conversation.js";
import { loadConversationFile, renderConversationMarkdown } from "../core/sessionStore.js";
import { expandPromptFileReferences } from "../core/fileReferences.js";
import {
  fetchOpenAICompatibleModels,
  generateOpenAICompatibleCompletion,
} from "../core/openaiClient.js";
import { runDoctor } from "../core/doctor.js";
import { extractTextWithMistralOcr } from "../core/mistralOcr.js";
import {
  printBanner,
  printFilesystemRoots,
  printHelp,
  printHistorySummary,
  printModels,
  printProviderDetails,
  printProvidersList,
  printResponseStats,
  printSystemPrompt,
  printUserMessage,
  printUserLine,
  buildResponseStats,
} from "../ui/output.js";

export function createDefaultRuntime() {
  return {
    clearLatexImages,
    renderFull,
    buildModelMessages,
    createAssistantMessage,
    createUserMessage,
    getMessageText,
    loadConversationFile,
    renderConversationMarkdown,
    expandPromptFileReferences,
    fetchOpenAICompatibleModels,
    generateOpenAICompatibleCompletion,
    extractTextWithMistralOcr,
    runDoctor,
    printBanner,
    printFilesystemRoots,
    printHelp,
    printHistorySummary,
    printModels,
    printProviderDetails,
    printProvidersList,
    printResponseStats,
    printSystemPrompt,
    printUserMessage,
    printUserLine,
    buildResponseStats,
    mkdirSync: fs.mkdirSync,
    writeFileSync: fs.writeFileSync,
    resolvePath: path.resolve,
    joinPath: path.join,
    dirname: path.dirname,
    now: Date.now,
    console,
  };
}
