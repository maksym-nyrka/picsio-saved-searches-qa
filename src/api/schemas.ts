import { z } from 'zod';

/**
 * Wire formats returned by the Pics.io endpoints used by this suite.
 * Schemas are intentionally permissive about fields we do not assert on,
 * but strict about the ones a client actually depends on.
 */

export const savedSearchNodeSchema = z
  .object({
    _id: z.string().min(1),
    name: z.string(),
    entity: z.string(),
    data: z.record(z.string(), z.unknown()),
    // Group placeholder nodes in the tree omit the ownership fields.
    creatorId: z.string().optional(),
    teamId: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .loose();

export type SavedSearchNode = z.infer<typeof savedSearchNodeSchema>;

export const savedSearchListSchema = z.object({
  nodes: z.array(savedSearchNodeSchema),
});

export const searchResultSchema = z
  .object({
    images: z.array(
      z
        .object({
          _id: z.string(),
          name: z.string(),
        })
        .loose(),
    ),
    total: z.number(),
  })
  .loose();

export type SearchResult = z.infer<typeof searchResultSchema>;

export const deleteResultSchema = z.object({ deleted: z.literal(true) }).loose();

export const apiErrorSchema = z
  .object({
    msg: z.string(),
    success: z.literal(false).optional(),
    subcode: z.string().optional(),
  })
  .loose();

export type ApiError = z.infer<typeof apiErrorSchema>;
