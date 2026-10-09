import { z } from "zod";

export const FailureSchema = z.object({ success: z.literal(false), message: z.string().optional() });

export const ListSchema = z.object({
  success: z.literal(true),
  pagination: z.array(z.number()).optional(),
  data: z.array(
    z.object({
      title: z.string(),
      image: z.string(),
      status: z.string().optional(),
      manwhaId: z.string(),
      latestEp: z.array(z.object({ title: z.string(), date: z.string().optional() })).optional(),
    }),
  ),
});

export const DetailSchema = z.object({
  success: z.literal(true),
  data: z.object({
    title: z.string(),
    status: z.string().optional(),
    image: z.string(),
    info: z.array(z.record(z.string(), z.union([z.string(), z.array(z.string())]))).optional(),
    summary: z.string().optional(),
    chapters: z.array(z.object({ name: z.string(), releaseDate: z.string().optional(), chapterId: z.string() })),
  }),
});

export const ChapterSchema = z.object({
  success: z.literal(true),
  data: z.object({ title: z.string().optional(), images: z.array(z.string()) }),
});
