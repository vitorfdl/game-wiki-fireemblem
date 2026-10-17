// Writes ../dishes.md, the readable view of ../dishes.json (the source of truth for meal dish reactions).
// Run after editing dishes.json: `deno task dishes-md` (or `node scripts/dishes-md.mjs`).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");
const d = JSON.parse(readFileSync(join(REPO, "dishes.json"), "utf8"));
const MARK = { love: "L", like: "l", neutral: ".", dislike: "X" };
const dishes = d.dishes.map((x) => x.name);
const out = [];
const w = (s = "") => out.push(s);

w("# Meal dish reactions");
w();
w(`Generated from \`dishes.json\` by \`site/scripts/dishes-md.mjs\` (${d.updated}). Edit the JSON, then rerun the script.`);
w("Meal rules are in `gifts-and-meals.md`.");
w();
w(`- ${d.about}`);
for (const [k, v] of Object.entries(d.conventions)) w(`- ${k[0].toUpperCase() + k.slice(1)}: ${v}`);
w(`- Marks: L = loves, l = likes, . = neutral, X = dislikes.`);
w();
w("## By character");
w();
w(`| Character | ${dishes.join(" | ")} | Likes+ |`);
w(`|---|${dishes.map(() => "---").join("|")}|---|`);
for (const [name, r] of Object.entries(d.reactions)) {
  const n = dishes.filter((x) => r[x] === "love" || r[x] === "like").length;
  w(`| ${name} | ${dishes.map((x) => MARK[r[x]] ?? "?").join(" | ")} | ${n}/${dishes.length} |`);
}
w();
w("## By dish");
w();
for (const dish of dishes) {
  const by = (v) => Object.entries(d.reactions).filter(([, r]) => r[dish] === v).map(([n]) => n);
  w(`- **${dish}**. Loves: ${by("love").join(", ") || "—"}. Dislikes: ${by("dislike").join(", ") || "—"}.`);
}
w();
w("## Sources");
w();
for (const s of d.sources) w(`- [${s.key}] ${s.url}: ${s.note}`);
w();
w("## Open questions");
w();
for (const q of d.openQuestions) w(`- ${q}`);
writeFileSync(join(REPO, "dishes.md"), out.join("\n") + "\n");
console.log("wrote dishes.md");
