import { MailContent } from './mail-content.js';
import { expect, type Locator, type Page } from './test-utils.js';

class Email {
	readonly email: Locator;
	readonly from: Locator;
	readonly to: Locator;
	readonly subject: Locator;

	constructor(email: Locator) {
		this.email = email;
		this.from = email.locator('div:first-child').first();
		this.to = email.locator('div:first-child > div > div');
		this.subject = email.locator('.subject');
	}

	async hasWelcomeEmailDetails() {
		expect.soft(await this.getFrom()).toEqual('ciso-assistant@tests.net');
		expect.soft(await this.getSubject()).toEqual('Welcome to Ciso Assistant!');
	}

	async hasResetPasswordEmailDetails() {
		expect.soft(await this.getFrom()).toEqual('ciso-assistant@tests.net');
		expect.soft(await this.getSubject()).toEqual('CISO Assistant: Password Reset');
	}

	async hasEmailRecipient(recipient: string) {
		expect.soft(await this.getTo()).toEqual(recipient);
	}

	async getFrom() {
		return (await this.from.innerText()).split('\n')[0];
	}

	async getTo() {
		return await this.to.innerText();
	}

	async getSubject() {
		return await this.subject.innerText();
	}

	async open() {
		await this.email.click();
	}
}

export class Mailer {
	readonly url: string;
	readonly emailContent: MailContent;
	private readonly emails: Locator;
	private reachable: boolean | null;

	constructor(public readonly page: Page) {
		this.url = 'http://localhost:' + (process.env.MAILER_WEB_SERVER_PORT || 8025);
		this.emailContent = new MailContent(page);
		this.emails = this.page.locator('.msglist-message');
		this.reachable = null;
	}

	async goto(): Promise<boolean> {
		try {
			await this.page.goto(this.url, { timeout: 5_000 });
			await this.page.waitForURL(this.url, { timeout: 5_000 });
			this.reachable = true;
			return true;
		} catch {
			this.reachable = false;
			return false;
		}
	}

	async isAvailable(): Promise<boolean> {
		if (this.reachable !== null) return this.reachable;
		return await this.goto();
	}

	async hasUrl() {
		await expect(this.page).toHaveURL(this.url);
	}

	async getEmails() {
		if (!(await this.isAvailable())) {
			throw new Error(`Mailer service is not reachable at ${this.url}`);
		}
		const emailElements = await this.emails.all();
		const emails: Email[] = [];
		emailElements.forEach((email) => {
			emails.push(new Email(email));
		});

		return emails;
	}

	async getLastEmail() {
		if (!(await this.isAvailable())) {
			throw new Error(`Mailer service is not reachable at ${this.url}`);
		}
		await expect(this.emails.first()).toBeVisible({ timeout: 15_000 });
		return new Email(this.emails.first());
	}
}
