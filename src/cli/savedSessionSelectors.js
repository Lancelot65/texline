import fs from "fs";
import path from "path";

import { buildChoiceList, selectWithSearch } from "./prompt.js";

export function listSavedConversationFiles(historyDir) {
  if (!fs.existsSync(historyDir)) return [];

  return fs
    .readdirSync(historyDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const filepath = path.join(historyDir, entry.name);
      const stat = fs.statSync(filepath);
      return {
        filepath,
        name: entry.name,
        updatedAt: stat.mtimeMs,
      };
    })
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function createSavedSessionSelectors(context) {
  async function selectSavedConversation(promptMessage) {
    const savedFiles = listSavedConversationFiles(context.historyDir);
    if (savedFiles.length === 0) return null;

    return selectWithSearch({
      message: promptMessage,
      defaultValue: savedFiles[0].filepath,
      choices: buildChoiceList(savedFiles, (entry) => ({
        value: entry.filepath,
        name: entry.name,
        description: new Date(entry.updatedAt).toLocaleString(),
      })),
    });
  }

  return {
    selectSavedConversation,
  };
}
