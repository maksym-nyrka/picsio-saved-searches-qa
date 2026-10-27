import { expect, type Locator, type Page } from '@playwright/test';
import { ResultsPage } from './results.page';

/**
 * The Saved Searches tree in the left panel.
 *
 * `:scope` keeps name matching on the item's own label: a group's <li> also
 * contains every descendant name, so a plain text filter silently matches the
 * root.
 */
export class SearchesTreePage {
  readonly page: Page;

  constructor(page: Page, private readonly results: ResultsPage) {
    this.page = page;
  }

  async openSavedSearchesPanel(): Promise<void> {
    // The panel remembers its open state across reloads, so clicking blindly would close it.
    const marker = this.page.locator('[data-testid="savedSearchCreateRootGroup-team"]');
    if (await marker.isVisible().catch(() => false)) return;

    await this.page.locator('.toolbarVertical .toolbarGroup').first().locator('button').nth(3).click();
    // The "New group" action only exists once the tree is mounted.
    await marker.waitFor({ state: 'visible', timeout: 20_000 });
  }

  savedSearchItem(name: string): Locator {
    return this.page
      .locator('li[role="treeitem"]')
      .filter({
        has: this.page.locator(':scope > .PicsioTreeItem__content .PicsioTreeItem__name', {
          hasText: name,
        }),
      })
      .first();
  }

  async openSavedSearch(name: string): Promise<void> {
    const item = this.savedSearchItem(name);
    await item.scrollIntoViewIfNeeded();

    // Clicking a collection whose filters are already applied does not re-issue the
    // search, so the response is optional here; the result assertions poll instead.
    const response = this.page
      .waitForResponse(
        (candidate) =>
          candidate.url().includes('/images/search') && candidate.request().method() === 'POST',
        { timeout: 8_000 },
      )
      .catch(() => null);

    await item.locator('.PicsioTreeItem__content').first().click();
    await response;
    await this.results.waitForResults();
  }

  async deleteSavedSearch(name: string): Promise<void> {
    const item = this.savedSearchItem(name);
    await item.scrollIntoViewIfNeeded();
    await item.hover();
    await item.getByTestId('savedSearchDelete').click();

    const dialog = this.page.locator('.simpleDialog').filter({ hasText: 'Delete saved search?' });
    await dialog.waitFor({ state: 'visible' });
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await expect(item).toHaveCount(0);
  }
}
