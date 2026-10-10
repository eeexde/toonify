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
}

export const MOCK_TITLES: MockTitle[] = [
  { slug: "alpha", title: "Skyward Blade", hue: 210, rating: "safe", status: "ongoing", summary: "A swordsman climbs the tower.", genres: ["Action", "Fantasy"], readable: 3, external: 4 },
  { slug: "beta", title: "Moonlit Bakery", hue: 30, rating: "safe", status: "completed", summary: "Bread, but at midnight.", genres: ["Slice of Life"], readable: 2 },
  { slug: "gamma", title: "Crimson Night", hue: 350, rating: "erotica", status: "ongoing", summary: "Adults only.", genres: ["Romance"], readable: 2 },
];

export const MOCK_PAGES_PER_CHAPTER = 5;
