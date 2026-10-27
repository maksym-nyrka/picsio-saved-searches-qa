import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The result grid below the filter bar.
 *
 * Waits live here rather than in the tests: the app renders `.catalogItem`s or
 * an empty-state message only after `/images/search` returns, so "the results
 * are ready" is one predicate covering both outcomes.
 */
export class ResultsPage {
  readonly page: Page;
  readonly results: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    this.results = page.locator('.catalogItem');
    // Two distinct empty states: a search with no matches, and an empty collection.
    this.emptyState = page
      .getByText(/There are no files in this collection|No assets in the collection/i)
      .first();
  }

  /** Waits until the client bundle has rendered the app shell. */
  async waitForShell(): Promise<void> {
    // The shell renders "Loading user data…" for several seconds before any controls exist.
    await this.page.waitForFunction(() => document.querySelectorAll('button').length > 20, null, {
      timeout: 30_000,
    });
  }

  /** Waits until a search response has been rendered: items or an explicit empty state. */
  async waitForResults(): Promise<void> {
    await this.page.waitForFunction(
      () =>
        document.querySelectorAll('.catalogItem').length > 0 ||
        /There are no files in this collection|No assets in the collection/i.test(document.body.innerText),
      null,
      { timeout: 25_000 },
    );
  }

  async itemCount(): Promise<number> {
    return this.results.count();
  }
}
