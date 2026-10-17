import { DISHES } from "virtual:refs";

/* Meal dish reactions from repo-root dishes.json (one owner). Reactions are per character and hold on every route.
   A meal is Perfect when every diner at least likes the dish. */

export type Taste = "love" | "like" | "neutral" | "dislike";

export const DISH_LIST: string[] = DISHES.list;
const SCORE: Record<Taste, number> = { love: 2, like: 1, neutral: 0, dislike: -2 };

export const hasDishes = (name: string): boolean => Boolean(DISHES.reactions[name]);
export const taste = (name: string, dish: string): Taste | undefined => DISHES.reactions[name]?.[dish];
const good = (t: Taste | undefined) => t === "love" || t === "like";

export type DishPick = {
  dish: string;
  tastes: (Taste | undefined)[];
  /** Every diner has data and at least likes it. */
  perfect: boolean;
  /** Someone at the table dislikes it. */
  bad: boolean;
  score: number;
};

/** All dishes for a table, best first: Perfect, then by total taste (love 2, like 1, dislike -2). */
export function rankDishes(diners: string[]): DishPick[] {
  return DISH_LIST.map((dish) => {
    const tastes = diners.map((d) => taste(d, dish));
    return {
      dish,
      tastes,
      perfect: tastes.every(good),
      bad: tastes.includes("dislike"),
      score: tastes.reduce((s, t) => s + (t ? SCORE[t] : 0), 0),
    };
  }).sort((a, b) => Number(b.perfect) - Number(a.perfect) || Number(a.bad) - Number(b.bad) || b.score - a.score);
}

/** Dishes that make the table Perfect. */
export const perfectFor = (diners: string[]): string[] =>
  rankDishes(diners).filter((p) => p.perfect).map((p) => p.dish);

/** Dishes this character dislikes. */
export const dislikes = (name: string): string[] => DISH_LIST.filter((d) => taste(name, d) === "dislike");
