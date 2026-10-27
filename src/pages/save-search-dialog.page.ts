import type { Locator, Page } from '@playwright/test';

/** The "Create saved search" dialog, opened from the filter bar's save icon. */
export class SaveSearchDialogPage {
  readonly page: Page;
  readonly dialog: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dialog = page.locator('.saveSearchHostDialog');
  }

  /** Opens the dialog from the filter bar, names the collection, and submits. */
  async saveAs(name: string): Promise<void> {
    await this.page.locator('button.searchFilters__iconBtn').nth(1).click();
    await this.dialog.waitFor({ state: 'visible' });
    await this.dialog.locator('input[placeholder="Please enter the name"]').fill(name);
    await this.dialog.getByRole('button', { name: 'Ok', exact: true }).click();
    await this.dialog.waitFor({ state: 'hidden' });
  }
}
