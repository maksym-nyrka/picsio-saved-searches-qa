import type { APIRequestContext } from '@playwright/test';
import {
  apiErrorSchema,
  deleteResultSchema,
  savedSearchListSchema,
  savedSearchNodeSchema,
  searchResultSchema,
  type ApiError,
  type SavedSearchNode,
  type SearchResult,
} from './schemas';

export type SavedSearchPayload = {
  name: string;
  data: Record<string, unknown>;
  shared?: boolean;
};

/** Status plus parsed body, so tests can assert on both without throwing. */
export type ApiResponse<T> = {
  status: number;
  body: T | null;
  raw: string;
  /** Wall-clock time of the call, for the API-latency budget asserted in the tests. */
  durationMs: number;
};

async function parse<T>(
  response: Awaited<ReturnType<APIRequestContext['post']>>,
  schema: { safeParse: (value: unknown) => { success: boolean; data?: T } },
  startedAt: number,
): Promise<ApiResponse<T>> {
  const raw = await response.text();
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }
  const parsed = schema.safeParse(json);
  return {
    status: response.status(),
    body: parsed.success ? (parsed.data as T) : null,
    raw,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Thin wrapper over the Saved Searches and search endpoints.
 *
 * Every method returns a result object instead of throwing, because most of the
 * API scenarios assert on negative paths (409, 404, 500) where a thrown error
 * would hide the payload we want to check.
 */
export class PicsApi {
  constructor(private readonly request: APIRequestContext) {}

  async createSavedSearch(payload: SavedSearchPayload) {
    const startedAt = Date.now();
    const response = await this.request.post('/savedSearches', { data: payload });
    return parse<SavedSearchNode>(response, savedSearchNodeSchema, startedAt);
  }

  async listSavedSearches() {
    const startedAt = Date.now();
    const response = await this.request.get('/savedSearches');
    return parse<{ nodes: SavedSearchNode[] }>(response, savedSearchListSchema, startedAt);
  }

  async deleteSavedSearch(id: string) {
    const startedAt = Date.now();
    const response = await this.request.delete(`/savedSearches/${id}`);
    return parse<{ deleted: true }>(response, deleteResultSchema, startedAt);
  }

  /** Executes filter criteria exactly as the UI does when a saved search is opened. */
  async search(data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    const startedAt = Date.now();
    const response = await this.request.post('/images/search', {
      data: { ...data, size: 50, from: 0, ...extra },
    });
    return parse<SearchResult>(response, searchResultSchema, startedAt);
  }

  async getAsset(id: string) {
    const startedAt = Date.now();
    const response = await this.request.get(`/images/${id}`);
    return parse<Record<string, unknown>>(response, {
      safeParse: (value) => ({ success: typeof value === 'object' && value !== null, data: value as Record<string, unknown> }),
    }, startedAt);
  }

  /** Replaces the asset's keywords. Used only by the live-update scenario, which restores them. */
  async setAssetKeywords(id: string, keywords: string[]) {
    const response = await this.request.patch(`/images/${id}`, { data: { keywords } });
    return { status: response.status(), raw: await response.text() };
  }

  /** Parses an error body when the endpoint returns one; returns null for HTML error pages. */
  errorBody(raw: string): ApiError | null {
    try {
      const parsed = apiErrorSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}
