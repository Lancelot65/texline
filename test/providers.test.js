import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProviderRegistry } from "../src/core/providers.js";

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "texline-providers-"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("custom providers do not default apiKeyEnv to OPENAI_API_KEY", (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  writeJson(providersFile, {
    activeProvider: "custom",
    providers: {
      custom: {
        baseURL: "https://example.com/v1",
        model: "custom-model",
      },
    },
  });

  const registry = createProviderRegistry({
    providersFile,
    env: {
      OPENAI_API_KEY: "should-not-be-used",
    },
  });

  const provider = registry.getActive();
  assert.equal(provider.apiKeyEnv, "");
  assert.equal(registry.resolveApiKey(provider), null);
});

test("builtin openai provider still resolves OPENAI_API_KEY", (t) => {
  const dir = makeTempDir();
  const providersFile = path.join(dir, "providers.json");
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const registry = createProviderRegistry({
    providersFile,
    env: {
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://api.openai.example/v1",
    },
  });

  assert.equal(registry.getProviders().openai.apiKeyEnv, "OPENAI_API_KEY");
  assert.equal(registry.resolveApiKey(registry.getProviders().openai), "openai-key");
});
