import { expect, type Page } from './test-utils.js';
import { BasePage } from './base-page.js';

export class AnalyticsPage extends BasePage {
	constructor(public readonly page: Page) {
		super(page, '/analytics', /Analytics/i);
		// this.page.goto('/analytics');
	}
}
