/* The names on the asset sheet (src/AssetSheet.tsx ASSET_NAMES), read as text: the sheet itself needs React, a test does not. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ASSET_NAMES_FILE = readFileSync(path.join(ROOT, "src", "AssetSheet.tsx"), "utf8");
