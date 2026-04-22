import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * In-process daily ingest scheduler. Spawns the ingest as a child process
 * at 06:00 UTC. Gated by INGEST_SCHEDULE_ENABLED=1 so local dev doesn't fire
 * it accidentally.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function nextFireUtc(hourUtc = 6): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0),
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

function resolveIngestEntry(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../ingest/dist/index.js");
}

let childRunning = false;

function runIngestOnce(): void {
  if (childRunning) {
    console.log("[scheduler] ingest already running, skipping this tick");
    return;
  }
  childRunning = true;
  const entry = resolveIngestEntry();
  console.log(`[scheduler] spawning ${entry}`);
  const child = spawn(process.execPath, [entry], {
    stdio: "inherit",
    env: process.env,
    detached: false,
  });
  child.on("exit", (code) => {
    childRunning = false;
    console.log(`[scheduler] ingest exited code=${code}`);
  });
  child.on("error", (err) => {
    childRunning = false;
    console.error("[scheduler] spawn error:", err);
  });
}

export function startIngestScheduler(): void {
  if (process.env.INGEST_SCHEDULE_ENABLED !== "1") {
    console.log("[scheduler] disabled (INGEST_SCHEDULE_ENABLED != '1')");
    return;
  }
  const delay = nextFireUtc(6);
  console.log(
    `[scheduler] first ingest in ${Math.round(delay / 60000)} min (next 06:00 UTC)`,
  );
  setTimeout(() => {
    runIngestOnce();
    setInterval(runIngestOnce, MS_PER_DAY);
  }, delay);
}
