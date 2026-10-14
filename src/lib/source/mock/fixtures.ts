import type { Kind } from "../filters";

export interface MockTitle {
  slug: string;
  title: string;
  hue: number;
  rating: "safe" | "erotica";
  status: "ongoing" | "completed";
  summary: string;
  genres: string[];
  readable: number;
  external?: number;
  kind: Kind;
}

export const MOCK_TITLES: MockTitle[] = [
  { slug: "alpha", title: "Skyward Blade", hue: 210, rating: "safe", status: "ongoing", summary: "A swordsman climbs the tower.", genres: ["Action", "Fantasy"], readable: 3, external: 4, kind: "manhwa" },
  { slug: "beta", title: "Moonlit Bakery", hue: 30, rating: "safe", status: "completed", summary: "Bread, but at midnight.", genres: ["Slice of Life"], readable: 2, kind: "manhwa" },
  { slug: "gamma", title: "Crimson Night", hue: 350, rating: "erotica", status: "ongoing", summary: "Adults only.", genres: ["Romance"], readable: 2, kind: "manhwa" },
  { slug: "delta", title: "Paper Lantern", hue: 140, rating: "safe", status: "ongoing", summary: "A lamp-maker's apprentice in old Kyoto.", genres: ["Drama", "Fantasy"], readable: 2, kind: "manga" },
  { slug: "epsilon", title: "Iron Courier", hue: 260, rating: "safe", status: "completed", summary: "Deliveries across a drowned Tokyo.", genres: ["Action"], readable: 1, kind: "manga" },
];

export const MOCK_PAGES_PER_CHAPTER = 5;
