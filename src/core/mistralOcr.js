import path from "path";

import { Mistral } from "@mistralai/mistralai";

let cachedClient = null;
let cachedApiKey = "";

function getMistralClient(apiKey) {
  if (cachedClient && cachedApiKey === apiKey) return cachedClient;
  cachedApiKey = apiKey;
  cachedClient = new Mistral({ apiKey });
  return cachedClient;
}

function formatOcrPages(response) {
  const pages = Array.isArray(response?.pages) ? response.pages : [];
  const pageText = pages
    .map((page) => String(page?.markdown || "").trim())
    .filter(Boolean)
    .join("\n\n");

  if (pageText) return pageText;
  if (typeof response?.documentAnnotation === "string" && response.documentAnnotation.trim()) {
    return response.documentAnnotation.trim();
  }

  throw new Error("OCR returned no extracted text");
}

export async function extractTextWithMistralOcr({ filePath, buffer, apiKey = process.env.MISTRAL_API_KEY }) {
  const resolvedApiKey = String(apiKey || "").trim();
  if (!resolvedApiKey) {
    throw new Error(`MISTRAL_API_KEY is required to read ${filePath}`);
  }

  const client = getMistralClient(resolvedApiKey);
  const fileName = path.basename(filePath);
  const uploadedFile = await client.files.upload({
    file: {
      fileName,
      content: buffer,
    },
    purpose: "ocr",
  });

  const response = await client.ocr.process({
    model: "mistral-ocr-latest",
    document: {
      type: "file",
      fileId: uploadedFile.id,
    },
    includeImageBase64: false,
  });

  return formatOcrPages(response);
}
