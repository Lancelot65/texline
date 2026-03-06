import chalk from "chalk";
import which from "which";

import { renderTexToPng } from "./texRenderer.js";
import { COLORS, bold, dim, err, good, warn } from "../ui/theme.js";

function findExecutable(cmd) {
  if (!cmd) return null;
  return which.sync(cmd, { nothrow: true }) || null;
}

function probeLatexRender(expression = "\\frac{a}{b}", mode = "inline") {
  const png = renderTexToPng(expression, mode);
  if (!png) return { ok: false, error: "render_failed" };
  return { ok: true, bytes: png.length };
}

function addProviderDoctorChecks(addCheck, providerRegistry) {
  const providerName = providerRegistry.getActiveName();
  const provider = providerRegistry.getActive();
  const providerKey = providerRegistry.resolveApiKey(provider);

  addCheck(!!providerName, "provider", providerName || "none selected");
  addCheck(!!provider?.baseURL, "provider baseURL", provider?.baseURL || "missing baseURL");
  addCheck(
    !!providerKey,
    "provider api key",
    providerKey
      ? `resolved via ${provider.apiKey ? "inline key" : provider.apiKeyEnv}`
      : `missing (${provider?.apiKeyEnv || "no apiKeyEnv"})`
  );
  addCheck(!!provider?.model, "provider model", provider?.model || "missing model");
}

function addRuntimeDoctorChecks(addCheck) {
  addCheck(true, "Node.js", process.version);

  const glowPath = findExecutable("glow");
  addCheck(!!glowPath, "glow", glowPath || "not found", "required");

  const latexPath = findExecutable("latex");
  const dvipngPath = findExecutable("dvipng");
  addCheck(!!latexPath, "latex", latexPath || "not found", "required");
  addCheck(!!dvipngPath, "dvipng", dvipngPath || "not found", "required");
}

function addLatexRenderDoctorChecks(addCheck) {
  const inlineProbe = probeLatexRender("\\frac{a}{b}", "inline");
  const blockProbe = probeLatexRender("\\begin{aligned}a&=b\\\\c&=d\\end{aligned}", "block");
  const renderOk = !!(inlineProbe?.ok && blockProbe?.ok);
  addCheck(
    renderOk,
    "TeX renderer",
    renderOk
      ? `ok (inline ${inlineProbe.bytes} B, block ${blockProbe.bytes} B)`
      : "failed (latex/dvipng pipeline issue)"
  );
}

function addTerminalDoctorChecks(addCheck) {
  const term = process.env.TERM || "unknown";
  const termProgram = process.env.TERM_PROGRAM || "";
  const kittyWindow = process.env.KITTY_WINDOW_ID || "";
  const supportsGraphics =
    term.includes("kitty") ||
    term.includes("ghostty") ||
    termProgram.toLowerCase().includes("ghostty") ||
    !!kittyWindow;

  addCheck(
    supportsGraphics,
    "terminal graphics",
    `TERM=${term}${termProgram ? `, TERM_PROGRAM=${termProgram}` : ""}${kittyWindow ? ", KITTY_WINDOW_ID=set" : ""}`,
    "optional"
  );
}

function addProvidersFileDoctorCheck(addCheck, providerRegistry) {
  addCheck(
    true,
    "providers config",
    `${providerRegistry.listNames().length} provider(s) · ${providerRegistry.providersFile}`,
    "optional"
  );
}

function addFilesystemDoctorChecks(addCheck, filesystemRegistry) {
  const roots = filesystemRegistry?.listRoots?.() || [];
  addCheck(
    roots.length > 0,
    "read-only file roots",
    roots.length > 0 ? `${roots.length} configured` : "none configured",
    "optional"
  );
  addCheck(
    !!process.env.MISTRAL_API_KEY,
    "Mistral OCR key",
    process.env.MISTRAL_API_KEY ? "MISTRAL_API_KEY set" : "missing MISTRAL_API_KEY",
    "optional"
  );
}

function printDoctorChecks(checks, hardFail) {
  console.log();
  console.log(chalk.hex(COLORS.border)("┌─ ") + bold("doctor"));
  for (const check of checks) {
    const mark = check.ok ? good("✓") : check.level === "required" ? err("✗") : warn("⚠");
    const label = check.level === "optional" ? dim(`${check.name} (optional)`) : bold(check.name);
    console.log(`${chalk.hex(COLORS.border)("│ ")}${mark} ${label} ${dim("·")} ${dim(check.detail)}`);
  }
  console.log(chalk.hex(COLORS.border)("└"));
  if (hardFail) {
    console.log(`\n  ${err("✗")} doctor found required issues.\n`);
    return;
  }
  console.log(`\n  ${good("✓")} doctor passed.\n`);
}

export function runDoctor({ providerRegistry, filesystemRegistry }) {
  const checks = [];
  const addCheck = (ok, name, detail, level = "required") => {
    checks.push({ ok, name, detail, level });
  };

  addProviderDoctorChecks(addCheck, providerRegistry);
  addRuntimeDoctorChecks(addCheck);
  addLatexRenderDoctorChecks(addCheck);
  addTerminalDoctorChecks(addCheck);
  addProvidersFileDoctorCheck(addCheck, providerRegistry);
  addFilesystemDoctorChecks(addCheck, filesystemRegistry);

  const hardFail = checks.some((check) => !check.ok && check.level === "required");
  printDoctorChecks(checks, hardFail);
}
