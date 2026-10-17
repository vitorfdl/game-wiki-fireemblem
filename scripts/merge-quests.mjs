// Merges src/data/quests/<route>.json into src/data/quests.gen.json (redesign/03-data-model.md §3).
// Shared quests dedupe by id; a different name, kind, task or reward for the same id fails the merge.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "src", "data", "quests");
const out = new Map();
const errors = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  for (const q of JSON.parse(readFileSync(join(dir, f), "utf8"))) {
    const prev = out.get(q.id);
    if (!prev) {
      out.set(q.id, structuredClone(q));
      continue;
    }
    for (const k of ["name", "kind", "task"]) {
      if (prev[k] !== q[k]) errors.push(`${q.id}: "${k}" differs between files (${prev[k]} / ${q[k]})`);
    }
    if (JSON.stringify(prev.reward ?? {}) !== JSON.stringify(q.reward ?? {})) errors.push(`${q.id}: reward differs`);
    for (const [r, v] of Object.entries(q.routes)) {
      if (prev.routes[r] && JSON.stringify(prev.routes[r]) !== JSON.stringify(v)) {
        errors.push(`${q.id}: ${r} dates differ between files`);
      }
      prev.routes[r] = v;
    }
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const list = [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(dir, "..", "quests.gen.json"), JSON.stringify(list, null, 2) + "\n");
console.log(`quests.gen.json: ${list.length} quests`);
