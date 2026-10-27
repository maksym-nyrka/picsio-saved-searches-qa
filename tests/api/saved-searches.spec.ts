import { expect, test } from '../../src/fixtures/test';

/**
 * TC-07 to TC-12 — the API contract behind Saved Searches.
 *
 * These run against the same account the UI suite uses, create their own data
 * with a per-test prefix, and clean up through the fixture.
 */

test.describe('Saved Searches API', () => {
  test('TC-07 POST /savedSearches stores the exact filter payload and returns the created node', async ({
    api,
    runId,
    createdIds,
  }) => {
    const name = `${runId}-tc07`;
    const data = { text: 'bottle', searchSource: 'searchbar' };

    const created = await api.createSavedSearch({ name, data, shared: true });
    if (created.body) createdIds.push(created.body._id);

    // Plan §7: every create/list/search call stays under 2 s in CI.
    expect(created.durationMs).toBeLessThan(2000);

    expect(created.status, created.raw).toBe(201);
    const body = created.body;
    expect(body).not.toBeNull();
    expect(body!.name).toBe(name);
    expect(body!.entity).toBe('assets');
    // The server injects the active collection and keyword scope; everything we sent must survive.
    expect(body!.data).toMatchObject(data);
    expect(body!.creatorId).toBeTruthy();
    expect(body!.teamId).toBeTruthy();
    expect(body!.createdAt).toBe(body!.updatedAt);
  });

  test('TC-08 GET /savedSearches returns that node with the same criteria', async ({
    api,
    runId,
    seedSavedSearch,
  }) => {
    const name = `${runId}-tc08`;
    const data = { text: 'bottle', searchSource: 'searchbar' };
    const created = await seedSavedSearch({ name, data });

    const listed = await api.listSavedSearches();
    // Plan §7: the list call stays under 2 s in CI.
    expect(listed.durationMs).toBeLessThan(2000);
    expect(listed.status).toBe(200);

    const persisted = listed.body!.nodes.filter((node) => node._id === created._id);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].name).toBe(name);
    // The criteria we sent survive; the server may add scope keys (collection, tag).
    expect(persisted[0].data).toMatchObject(data);

    // And a second read returns byte-for-byte the same criteria, so nothing drifts between calls.
    const again = await api.listSavedSearches();
    const reread = again.body!.nodes.find((node) => node._id === created._id);
    expect(reread?.data).toEqual(persisted[0].data);
  });

  test('TC-09 duplicate name in the same location is rejected with a structured error', async ({
    api,
    runId,
    seedSavedSearch,
  }) => {
    const name = `${runId}-tc09`;
    await seedSavedSearch({ name, data: { text: 'bottle' } });

    // Same name, same location (shared → team root) is what the duplicate rule covers.
    const duplicate = await api.createSavedSearch({ name, data: { text: 'bottle' }, shared: true });
    expect(duplicate.status).toBe(409);

    const error = api.errorBody(duplicate.raw);
    expect(error).not.toBeNull();
    expect(error!.success).toBe(false);
    expect(error!.msg).toMatch(/already exists/i);
    expect(error!.subcode).toBe('SavedSearchDuplicateAtLocationApiError');

    // The rejection must not leave a second node behind.
    const list = await api.listSavedSearches();
    expect(list.body!.nodes.filter((node) => node.name === name)).toHaveLength(1);
  });

  test('TC-10 DELETE /savedSearches/:id removes the node and a repeat delete is a clean 404', async ({
    api,
    runId,
    seedSavedSearch,
  }) => {
    const name = `${runId}-tc10`;
    const created = await seedSavedSearch({ name, data: { text: 'bottle' } });

    const first = await api.deleteSavedSearch(created._id);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ deleted: true });

    const afterDelete = await api.listSavedSearches();
    expect(afterDelete.body!.nodes.some((node) => node._id === created._id)).toBe(false);

    const second = await api.deleteSavedSearch(created._id);
    expect(second.status).toBe(404);
  });

  test('TC-11 POST /images/search executes the saved criteria and returns the expected set', async ({
    api,
    runId,
    seedSavedSearch,
  }) => {
    const created = await seedSavedSearch({
      name: `${runId}-tc11`,
      data: { text: 'bottles', searchSource: 'searchbar' },
    });

    const searched = await api.search(created.data);
    // Plan §7: the search call stays under 2 s in CI.
    expect(searched.durationMs).toBeLessThan(2000);
    expect(searched.status, searched.raw).toBe(200);
    const body = searched.body;
    expect(body).not.toBeNull();

    expect(body!.total).toBe(body!.images.length);
    expect(body!.total).toBeGreaterThan(0);
    // The library fixture contains exactly one asset whose name and keyword are "bottle".
    expect(body!.images.map((image) => image.name)).toContain('Amber glass bottles.jpg');
    expect(body!.images.every((image) => /bottle/i.test(image.name))).toBe(true);
  });

  test('TC-12 create-time validation rejects a filter payload the search endpoint cannot execute', async ({
    api,
    runId,
    createdIds,
  }) => {
    test.fail(
      true,
      'Observed on 8.23.1: the create call returns 201 and the saved search then fails with 500 when opened.',
    );

    const data = { keywordsOperator: 'nope', keywords: ['x'] };
    const created = await api.createSavedSearch({ name: `${runId}-tc12`, data });
    if (created.body) createdIds.push(created.body._id);

    // A client-visible filter that the executor rejects should never be stored.
    expect(created.status).toBeGreaterThanOrEqual(400);
    expect(created.status).toBeLessThan(500);

    const search = await api.search(created.body!.data);
    expect(search.status).toBe(200);
  });
});
