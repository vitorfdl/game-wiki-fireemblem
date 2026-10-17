import guide from "../data/mount-guide.json" with { type: "json" };
import type { RouteName } from "./types.ts";

export type Family = "Ornius" | "Horse" | "Pegasus" | "Bau" | "Elephant";
export type Spawn = { place: string; rare: boolean };
export type Breed = {
  name: string;
  slug: string;
  family: Family;
  rare: boolean;
  abilities: string[];
  /** Bond 5 totals: flat stat points and growth percent. */
  bonus: { stat: string; flat: number; growth: number }[];
  food: string;
  taste: string;
  spawns: Spawn[];
  part: string;
  note: string | null;
  unique: string | null;
};
export type MountRec = {
  unit: string;
  cls: string;
  mount: string;
  when: string;
  where: string;
  why: string;
  alt: string | null;
  /** Paired ability to reroll for. */
  roll?: string;
};

export const MOUNT_SOURCE: string = guide.source;
export const FAMILIES = guide.families as Record<Family, { food: string; classes: string }>;
export const BREEDS = guide.breeds as Breed[];
export const TAMING_TIPS: string[] = guide.tips;
export type Food = { slug: string; name: string; food: string; taste: string };
/** Every cooking ingredient by mount food type and taste. "Vegetable" covers all plant ingredients. */
export const FOODS = guide.foods as Food[];
export const FOOD_SOURCE: string = guide.foodSource;
export const foodUrl = (f: Food) => `https://fortunesweave.co.uk/items/${f.slug}`;
export const BREED_BY_NAME = new Map(BREEDS.map((b) => [b.name.toLowerCase(), b]));
/** Short forms the walkthrough uses. */
BREED_BY_NAME.set("ferghanan", BREED_BY_NAME.get("ferghanan horse")!);

export const breedUrl = (b: Breed) => `${MOUNT_SOURCE}#${b.slug}`;
export const mountRecs = (route: RouteName): MountRec[] => (guide.recs as Record<string, MountRec[]>)[route] ?? [];
/** The Stable is Cai's: only his route gets the Mounts tab and mount links. */
export const hasStable = (route: RouteName) => route === "Cai";

export function mountNamePattern(): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...BREEDS.filter((b) => !b.unique).map((b) => b.name), "Ferghanan"]
    .sort((a, b) => b.length - a.length)
    .map(esc)
    .join("|");
}

/** Units the route recommends for a breed, in roster order. */
export function ridersOf(route: RouteName, breed: Breed): string[] {
  return [...new Set(mountRecs(route).filter((r) => r.mount === breed.name).map((r) => r.unit))];
}
