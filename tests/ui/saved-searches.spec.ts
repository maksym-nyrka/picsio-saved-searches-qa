import { expect, test } from '../../src/fixtures/test';

/**
 * TC-01 to TC-06 — the journey a user repeats: save, reopen, re-run, empty
 * state, delete.
 *
 * Every test asserts on what is visible on screen. Result counts are compared
 * before and after an action rather than hard-coded, except where the library
 * fixture is deliberately known (one asset whose filename contains "bottles").
 */

test.describe('Saved Searches UI', () => {
  test.beforeEach(async ({ page, resultsPage }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });
    await resultsPage.waitForShell();
  });

  test('TC-01 save a single-term search, find it in the tree, reopen it', async ({
    api,
    runId,
    createdIds,
    filterPanel,
    saveDialog,
    searchesTree,
    resultsPage,
  }) => {
    await filterPanel.search('bottles');

    const before = await resultsPage.itemCount();
    expect(before).toBeGreaterThan(0);

    const name = `${runId}-tc01`;
    await saveDialog.saveAs(name);
    await trackByName(api, name, createdIds);

    await searchesTree.openSavedSearchesPanel();
    await expect(searchesTree.savedSearchItem(name)).toBeVisible();

    // The stored criteria are what reopening replays, so assert them directly.
    const list = await api.listSavedSearches();
    const stored = list.body!.nodes.find((node) => node.name === name);
    expect(stored, `saved search ${name} should exist`).toBeDefined();
    expect(JSON.stringify(stored!.data)).toContain('bottles');

    await searchesTree.openSavedSearch(name);
    await expect.poll(() => resultsPage.itemCount()).toBe(before);
  });

  test('TC-02 save a multi-filter search and reopen it with the same criteria', async ({
    api,
    runId,
    createdIds,
    filterPanel,
    saveDialog,
    searchesTree,
    resultsPage,
  }) => {
    await filterPanel.addFilenameFilter('Amber');
    await filterPanel.addTypeFilter('Images');

    const before = await resultsPage.itemCount();
    expect(before).toBeGreaterThan(0);

    const name = `${runId}-tc02`;
    await saveDialog.saveAs(name);
    await trackByName(api, name, createdIds);

    await searchesTree.openSavedSearchesPanel();
    await searchesTree.openSavedSearch(name);

    // Both criteria survive the round-trip: visibly in the filter bar, and in the stored payload.
    const chips = await filterPanel.chipTexts();
    expect(chips.some((chip) => chip.includes('Amber'))).toBe(true);
    expect(chips.some((chip) => chip.includes('Images'))).toBe(true);

    const list = await api.listSavedSearches();
    const stored = list.body!.nodes.find((node) => node.name === name);
    expect(stored, `saved search ${name} should exist`).toBeDefined();
    expect(stored!.data.type).toBe('images');
    expect(JSON.stringify(stored!.data)).toContain('Amber');

    await expect.poll(() => resultsPage.itemCount()).toBe(before);
  });

  test('TC-03 reloading the app keeps the collection and its results identical', async ({
    page,
    api,
    runId,
    createdIds,
    filterPanel,
    saveDialog,
    searchesTree,
    resultsPage,
  }) => {
    await filterPanel.search('bottles');

    const name = `${runId}-tc03`;
    await saveDialog.saveAs(name);
    await trackByName(api, name, createdIds);

    await searchesTree.openSavedSearchesPanel();
    await searchesTree.openSavedSearch(name);
    const before = await resultsPage.itemCount();
    expect(before).toBeGreaterThan(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await resultsPage.waitForShell();

    await searchesTree.openSavedSearchesPanel();
    await expect(searchesTree.savedSearchItem(name)).toBeVisible();

    await searchesTree.openSavedSearch(name);
    await expect.poll(() => resultsPage.itemCount()).toBe(before);
  });

  test('TC-04 reopening a collection re-runs its own query, not the last search', async ({
    api,
    runId,
    createdIds,
    filterPanel,
    saveDialog,
    searchesTree,
    resultsPage,
  }) => {
    await filterPanel.search('bottles');

    const savedCount = await resultsPage.itemCount();
    expect(savedCount).toBeGreaterThan(0);

    const name = `${runId}-tc04`;
    await saveDialog.saveAs(name);
    await trackByName(api, name, createdIds);

    // Leave the page showing a different result set.
    await filterPanel.search('Guide');
    const otherCount = await resultsPage.itemCount();
    expect(otherCount).toBeGreaterThan(0);
    expect(otherCount).not.toBe(savedCount);

    await searchesTree.openSavedSearchesPanel();
    await searchesTree.openSavedSearch(name);

    // The saved collection applies its own criteria again instead of showing the last query.
    await expect(filterPanel.searchInput).toHaveValue('bottles');
    await expect.poll(() => resultsPage.itemCount()).toBe(savedCount);
  });

  test('TC-05 a zero-result search saves and opens with an explicit empty state', async ({
    page,
    api,
    runId,
    createdIds,
    filterPanel,
    saveDialog,
    searchesTree,
    resultsPage,
  }) => {
    await filterPanel.search('zzz-no-such-asset-qa');
    await expect.poll(() => resultsPage.itemCount()).toBe(0);
    await expect(resultsPage.emptyState).toBeVisible();

    const name = `${runId}-tc05`;
    await saveDialog.saveAs(name);
    await trackByName(api, name, createdIds);

    await searchesTree.openSavedSearchesPanel();
    await searchesTree.openSavedSearch(name);

    await expect.poll(() => resultsPage.itemCount()).toBe(0);
    await expect(resultsPage.emptyState).toBeVisible();
    await expect(page.locator('.simpleDialog')).toHaveCount(0);
  });

  test('TC-06 deleting a collection removes it from the tree, after reload, and from the API', async ({
    page,
    api,
    runId,
    seedSavedSearch,
    searchesTree,
    resultsPage,
  }) => {
    const name = `${runId}-tc06`;
    const created = await seedSavedSearch({ name, data: { text: 'bottles' } });

    // The app fetched its tree before the seed, so reload to pick the node up.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await resultsPage.waitForShell();

    await searchesTree.openSavedSearchesPanel();
    await expect(searchesTree.savedSearchItem(name)).toBeVisible();

    await searchesTree.deleteSavedSearch(name);
    await expect(searchesTree.savedSearchItem(name)).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await resultsPage.waitForShell();
    await searchesTree.openSavedSearchesPanel();
    await expect(searchesTree.savedSearchItem(name)).toHaveCount(0);

    const list = await api.listSavedSearches();
    expect(list.body!.nodes.some((node) => node._id === created._id)).toBe(false);
  });
});

/** Registers a UI-created saved search for fixture cleanup. */
async function trackByName(
  api: import('../../src/api/client').PicsApi,
  name: string,
  createdIds: string[],
): Promise<void> {
  const list = await api.listSavedSearches();
  const node = list.body?.nodes.find((candidate) => candidate.name === name);
  if (node) createdIds.push(node._id);
}
