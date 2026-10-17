// Writes ../gifts.md, the readable view of ../gifts.json (the source of truth for gifts).
// Run after editing gifts.json: `deno task gifts-md` (or `node scripts/gifts-md.mjs`).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..");
const d = JSON.parse(readFileSync(join(REPO, "gifts.json"), "utf8"));
const dag = new Set(Object.entries(d.shops).filter(([, s]) => s.dagsion).map(([k]) => k));
const label = (shop) => (dag.has(shop) ? d.shops[shop].where.split(",")[0] : shop);
const sale = (s) =>
  `${label(s.shop)}${s.from ? ` (from Ch ${s.from})` : ""}${s.conf === "unconfirmed" ? "?" : ""}${s.conf === "player" ? " (seen in game)" : ""}`;
const price = (g) => (g.price ? `${g.price}G` : "—");
const cell = (xs) => (xs?.length ? xs.join(", ") : "—");
const out = [];
const w = (s = "") => out.push(s);

w("# Gifts");
w();
w(`Generated from \`gifts.json\` by \`site/scripts/gifts-md.mjs\` (${d.updated}). Edit the JSON, then rerun the script.`);
w("Meal rules and dish reactions are in `gifts-and-meals.md`.");
w();
w("## Rules");
w();
for (const r of d.rules) w(`- ${r}`);
w(`- Prices: ${d.conventions.price}`);
w(`- Tiers: ${d.conventions.tiers}`);
w();
w("## Dagsion stalls (no Turn cost)");
w();
w("| Stall | Restock | Stock (base price) |");
w("|---|---|---|");
for (const shop of dag) {
  const items = d.gifts
    .flatMap((g) => g.sold.filter((s) => s.shop === shop).map((s) => ({ g, s })))
    .sort((a, b) => (a.s.from ?? 0) - (b.s.from ?? 0) || (a.s.conf ? 1 : 0) - (b.s.conf ? 1 : 0) || (a.g.price ?? 1e9) - (b.g.price ?? 1e9))
    .map(({ g, s }) => `${g.name} ${price(g)}${s.from ? ` (from Ch ${s.from})` : ""}${s.conf === "unconfirmed" ? "?" : ""}`);
  w(`| ${d.shops[shop].where} | ${d.shops[shop].restock} | ${items.join(", ")} |`);
}
w();
w("`?` = not in the current Game8 merchant list (see Open questions).");
w();
w("## By character");
w();
w("Best Dagsion buy first. Settlement gifts cost Turns unless the route already goes there.");
w();
w("| Character | Loved | Really liked, Dagsion | Really liked, elsewhere |");
w("|---|---|---|---|");
const people = [...new Set(d.gifts.flatMap((g) => [...g.loved, ...g.really]))].sort();
const inDag = (g) => g.sold.some((s) => dag.has(s.shop) && s.conf !== "unconfirmed" && !s.from);
const dagLate = (g) => g.sold.find((s) => dag.has(s.shop) && s.from)?.from;
for (const p of people) {
  const loved = d.gifts.filter((g) => g.loved.includes(p)).sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  const really = d.gifts.filter((g) => g.really.includes(p)).sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  const fmt = (g) => `${g.name} ${price(g)}`;
  w(`| ${p} | ${cell(loved.map((g) => `${fmt(g)}${inDag(g) ? " (Dagsion)" : dagLate(g) ? ` (Dagsion from Ch ${dagLate(g)})` : ""}`))} | ${cell(really.filter(inDag).map(fmt))} | ${cell(really.filter((g) => !inDag(g)).map(fmt))} |`);
}
w();
w("## Catalog");
w();
w("| Gift | Price | Rarity | Sold at | Loved by | Really liked by |");
w("|---|---|---|---|---|---|");
for (const g of d.gifts) {
  const where = [...g.sold.map(sale), g.other].filter(Boolean).join("; ");
  w(`| ${g.name} | ${price(g)} | ${g.rarity} | ${where || "Unknown"} | ${cell(g.loved)} | ${cell(g.really)} |`);
}
w();
w("## Restricted places");
w();
for (const [k, v] of Object.entries(d.places)) w(`- **${k}:** ${v.note}`);
w();
w("## Avoid");
w();
for (const a of d.avoid) w(`- **${a.what}** for ${a.who.join(", ")} (${a.src.join(", ")})`);
w();
w("## Open questions");
w();
for (const q of d.open_questions) w(`- ${q}`);
w();
w("## Sources");
w();
for (const s of d.sources) w(`- [${s.key}] ${s.url}${s.note ? ` (${s.note})` : ""}`);
if (d.characters) {
  w();
  w("## What each character likes (by category)");
  w();
  w("Use for gifts the catalog doesn't tag yet; item lists above win.");
  w();
  w("| Character | Likes | Categories | Also | Not |");
  w("|---|---|---|---|---|");
  for (const [n, c] of Object.entries(d.characters).sort()) {
    w(`| ${n} | ${c.bio} | ${cell(c.categories)} | ${cell(c.extra)} | ${cell(c.not)} |`);
  }
}
if (d.sourcing) {
  w();
  w("## Where to buy by type");
  w();
  for (const s of d.sourcing) w(`- ${s}`);
}
writeFileSync(join(REPO, "gifts.md"), out.join("\n") + "\n");
console.log(`gifts.md: ${d.gifts.length} gifts, ${people.length} characters`);
