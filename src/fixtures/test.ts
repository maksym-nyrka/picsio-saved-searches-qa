import path from 'node:path';
import { test as base, request } from '@playwright/test';
import { PicsApi } from '../api/client';
import type { SavedSearchNode } from '../api/schemas';
import { FilterPanelPage } from '../pages/filter-panel.page';
import { ResultsPage } from '../pages/results.page';
import { SaveSearchDialogPage } from '../pages/save-search-dialog.page';
import { SearchesTreePage } from '../pages/searches-tree.page';

const BASE_URL = process.env.BASE_URL ?? 'https://pics.io';
const STATE_PATH = path.resolve('.auth/state.json');

type Fixtures = {
  /** Authenticated API client that reuses the same session as the browser. */
  api: PicsApi;
  /** Unique per test, so parallel or repeated runs never collide. */
  runId: string;
  /** Saved searches created by the test; deleted automatically afterwards. */
  createdIds: string[];
  /** Creates a saved search through the API and registers it for cleanup. */
  seedSavedSearch: (input: {
    name: string;
    data: Record<string, unknown>;
    shared?: boolean;
  }) => Promise<SavedSearchNode>;
  resultsPage: ResultsPage;
  filterPanel: FilterPanelPage;
  saveDialog: SaveSearchDialogPage;
  searchesTree: SearchesTreePage;
};

export const test = base.extend<Fixtures>({
  api: async ({}, use) => {
    const context = await request.newContext({
      baseURL: BASE_URL,
      storageState: STATE_PATH,
      extraHTTPHeaders: { accept: 'application/json' },
    });
    await use(new PicsApi(context));
    await context.dispose();
  },

  runId: async ({}, use) => {
    await use(`qa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  },

  createdIds: async ({ api }, use) => {
    const ids: string[] = [];
    await use(ids);
    for (const id of ids) {
      await api.deleteSavedSearch(id).catch(() => undefined);
    }
  },

  seedSavedSearch: async ({ api, createdIds }, use) => {
    await use(async ({ name, data, shared = true }) => {
      const { status, body, raw } = await api.createSavedSearch({ name, data, shared });
      if (status !== 201 || !body) {
        throw new Error(`Failed to seed saved search "${name}": ${status} ${raw}`);
      }
      createdIds.push(body._id);
      return body;
    });
  },

  resultsPage: async ({ page }, use) => {
    await use(new ResultsPage(page));
  },

  filterPanel: async ({ page, resultsPage }, use) => {
    await use(new FilterPanelPage(page, resultsPage));
  },

  saveDialog: async ({ page }, use) => {
    await use(new SaveSearchDialogPage(page));
  },

  searchesTree: async ({ page, resultsPage }, use) => {
    await use(new SearchesTreePage(page, resultsPage));
  },
});

export { expect } from '@playwright/test';
