// Minimal background worker: polls the job-tick endpoint on an interval.
// Run with: node scripts/worker.mjs   (after `npm run dev` / production server).
import { readFileSync } from "node:fs";

// Load .env without a dependency.
try {
  for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // no .env, rely on process env
}

const BASE = process.env.WORKER_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TOKEN = process.env.APP_SECRET;
const INTERVAL = Number(process.env.JOB_POLL_INTERVAL_MS || 5000);

if (!TOKEN) {
  console.error("APP_SECRET is required to authenticate the worker.");
  process.exit(1);
}

console.log(`Ure worker polling ${BASE}/api/jobs/tick every ${INTERVAL}ms`);

async function tick() {
  try {
    const res = await fetch(`${BASE}/api/jobs/tick`, {
      method: "POST",
      headers: { "x-worker-token": TOKEN },
    });
    const json = await res.json();
    if (json?.data?.processed) {
      console.log(new Date().toISOString(), "drained", json.data);
    }
  } catch (err) {
    console.error("tick error:", err.message);
  }
}

await tick();
setInterval(tick, INTERVAL);
