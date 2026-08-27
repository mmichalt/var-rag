import { z } from 'zod';

export const ChunkLocatorSchema = z.object({
  lawNumber: z.string().nullable(),
  headingPath: z.array(z.string()),
  pageStart: z.number().int().positive(),
  pageEnd: z.number().int().positive(),
  paragraphOrdinal: z.number().int().nonnegative(),
});

export type ChunkLocator = z.infer<typeof ChunkLocatorSchema>;

export function parseLocator(value: unknown): ChunkLocator {
  return ChunkLocatorSchema.parse(value);
}
