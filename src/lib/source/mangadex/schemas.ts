import { z } from "zod";

const Loc = z.preprocess((v) => (Array.isArray(v) ? {} : v), z.record(z.string(), z.string()));

const Relationship = z.object({
  id: z.string(),
  type: z.string(),
  attributes: z.record(z.string(), z.unknown()).nullish(),
});

export const MangaSchema = z.object({
  id: z.string(),
  attributes: z.object({
    title: Loc,
    altTitles: z.array(Loc),
    description: Loc,
    status: z.string().nullable(),
    contentRating: z.string(),
    tags: z.array(z.object({ attributes: z.object({ name: Loc, group: z.string() }) })),
  }),
  relationships: z.array(Relationship),
});
export type MdManga = z.infer<typeof MangaSchema>;

const Collection = <T extends z.ZodType>(item: T) =>
  z.object({ result: z.literal("ok"), data: z.array(item), limit: z.number(), offset: z.number(), total: z.number() });

export const MangaListSchema = Collection(MangaSchema);

export const TagListSchema = z.object({
  result: z.literal("ok"),
  data: z.array(z.object({ id: z.string(), attributes: z.object({ name: Loc, group: z.string() }) })),
});
export const MangaEntitySchema = z.object({ result: z.literal("ok"), data: MangaSchema });

export const ChapterSchema = z.object({
  id: z.string(),
  attributes: z.object({
    chapter: z.string().nullable(),
    title: z.string().nullable(),
    externalUrl: z.string().nullable(),
    pages: z.number(),
    publishAt: z.string(),
    readableAt: z.string().nullish(),
  }),
  relationships: z.array(Relationship),
});
export type MdChapter = z.infer<typeof ChapterSchema>;

export const FeedSchema = Collection(ChapterSchema);

export const AtHomeSchema = z.object({
  result: z.literal("ok"),
  baseUrl: z.string().url(),
  chapter: z.object({ hash: z.string(), data: z.array(z.string()) }),
});
