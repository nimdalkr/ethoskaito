import { z } from "zod";

export const tweetIngestPayloadSchema = z.object({
  tweetId: z.string().min(1),
  tweetUrl: z.string().url(),
  xUsername: z.string().min(1),
  observedAt: z.string().datetime(),
  source: z.string().min(1)
});

export const ingestBatchSchema = z.object({
  tweets: z.array(tweetIngestPayloadSchema).min(1).max(100)
});

export type IngestBatchInput = z.infer<typeof ingestBatchSchema>;
