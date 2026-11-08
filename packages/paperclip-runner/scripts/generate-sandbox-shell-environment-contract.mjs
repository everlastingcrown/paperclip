import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../", import.meta.url);
const schema = JSON.parse(readFileSync(new URL("protocol/provider-schemas/sandbox-shell-environment.schema.json", root), "utf8"));
const output = `export const SANDBOX_SHELL_ENVIRONMENT_KEYS = ${JSON.stringify(schema["x-environment-key"])};\n`;
const path = new URL("src/generated-sandbox-shell-environment-contract.ts", root);
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== output) throw new Error("Stale sandbox shell environment contract");
} else writeFileSync(path, output);
