declare module "virtual:portraits" {
  export const PORTRAITS: string[];
  export const OPAQUE: string[];
  export const ART: string[];
}

declare module "virtual:refs" {
  export const ITEMS: Record<string, import("./lib/refs.ts").ItemRef>;
  export const BATTALIONS: Record<string, import("./lib/refs.ts").BattalionRef>;
  export const CLASS_REF: Record<string, import("./lib/refs.ts").ClassRef>;
  export const ARTS: Record<string, import("./lib/refs.ts").ArtRef>;
  export const ABILITIES: Record<string, import("./lib/refs.ts").AbilityRef>;
  export const STATS: Record<string, import("./lib/refs.ts").StatRef>;
  export const PLACE_LOOT: Record<
    string,
    {
      buy: { item: string; price?: number }[];
      barter: { item: string; cost?: string }[];
      chests?: { p1: string[]; p3: string[]; note?: string };
    }
  >;
  export const GIFTS: Record<string, import("./lib/gifts.ts").Gift>;
  export const DISHES: { list: string[]; reactions: Record<string, Record<string, import("./lib/dishes.ts").Taste>> };
  export const GIFT_SHOPS: Record<string, import("./lib/gifts.ts").GiftShop>;
  export const GIFT_PLACES: Record<string, { note: string; routes?: string[] }>;
  export const GIFT_PROFILES: Record<string, import("./lib/gifts.ts").GiftProfile>;
  export const PART2: import("./lib/parts.ts").Part2Data;
  export const PART3: import("./lib/parts.ts").Part3Data;
  export const GODS: import("./lib/parts.ts").GodsData;
  export const GIFT_AVOID: { who: string[]; what: string; src?: string[] }[];
}
