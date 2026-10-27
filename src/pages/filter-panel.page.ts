import type { Locator, Page, Response } from '@playwright/test';
import { ResultsPage } from './results.page';

/**
 * The search bar and filter chips above the results grid.
 *
 * Every filtering action waits for the `/images/search` call it triggers. The
 * filter state is committed to the URL slightly after the response, so saving
 * before that point would capture the previous criteria.
 */
export class FilterPanelPage {
  readonly page: Page;
  readonly searchInput: Locator;

  constructor(page: Page, private readonly results: ResultsPage) {
    this.page = page;
    this.searchInput = page.locator('input.react-autosuggest__input').first();
  }

  private searchResponse(): Promise<Response> {
    return this.page.waitForResponse(
      (response) => response.url().includes('/images/search') && response.request().method() === 'POST',
      { timeout: 25_000 },
    );
  }

  async search(term: string): Promise<void> {
    const response = this.searchResponse();
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
    await response;
    await this.page
      .waitForFunction((value) => new URL(location.href).searchParams.get('text') === value, term, {
        timeout: 10_000,
      })
      .catch(() => undefined);
    await this.results.waitForResults();
  }

  /** Adds a keyword filter through the filter bar, as a user would. */
  async addKeywordFilter(value: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Keyword', exact: true }).click();
    await this.page.locator('.react-select__control:visible').first().click();
    await this.page.locator('.react-select__option:visible', { hasText: 'is any of' }).first().click();

    const input = this.page.locator('input[placeholder="Add or paste keywords"]');
    await input.waitFor({ state: 'visible' });

    const response = this.searchResponse();
    await input.fill(value);
    await input.press('Enter');
    await response;
    await this.results.waitForResults();
  }

  /** Adds a file-type filter. The type chip opens its value list directly. */
  async addTypeFilter(value: string): Promise<void> {
    await this.page.getByRole('button', { name: 'Type', exact: true }).click();
    await this.page.locator('.react-select__control:visible').first().click();

    const response = this.searchResponse();
    await this.page.locator('.react-select__option:visible', { hasText: value }).first().click();
    await response;
    await this.results.waitForResults();
  }

  /** Adds a filename filter. The chip opens an operator select, then a value box and Confirm. */
  async addFilenameFilter(value: string, operator = 'contains'): Promise<void> {
    await this.page.getByRole('button', { name: 'Filename', exact: true }).click();
    await this.page.locator('.react-select__control:visible').first().click();
    await this.page.locator('.react-select__option:visible', { hasText: operator }).first().click();

    await this.page.locator('input[placeholder="Value"]').fill(value);
    const response = this.searchResponse();
    await this.page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await response;
    await this.results.waitForResults();
  }

  /** Text of every chip currently in the filter bar. */
  async chipTexts(): Promise<string[]> {
    return this.page
      .locator('.searchFilterItem')
      .allInnerTexts()
      .then((texts) => texts.map((text) => text.trim().replace(/\s+/g, ' ')));
  }
}
