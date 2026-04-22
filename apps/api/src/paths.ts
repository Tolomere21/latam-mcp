import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findRepoRoot(start: string): string {
  let cur = start;
  while (cur !== dirname(cur)) {
    if (existsSync(resolve(cur, "pnpm-workspace.yaml"))) return cur;
    cur = dirname(cur);
  }
  return start;
}

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = findRepoRoot(here);
export const defaultPadronDbPath = resolve(repoRoot, "data/padron.sqlite");
