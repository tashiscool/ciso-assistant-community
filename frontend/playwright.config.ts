import type { PlaywrightTestConfig } from '@playwright/test';
import { devices } from '@playwright/test';

const composeMode = !!process.env.COMPOSE_TEST;
const useDevServer = process.env.PLAYWRIGHT_DEV_SERVER === 'true';
const previewPort = Number(
	process.env.PLAYWRIGHT_PORT || (composeMode ? 3000 : 4174)
);
const baseURL = process.env.ORIGIN || `http://127.0.0.1:${previewPort}`;

const config: PlaywrightTestConfig = {
	webServer: {
		command: composeMode
			? 'echo "The docker compose frontend server didn\'t start correctly"'
			: useDevServer
				? `pnpm exec vite dev --host 127.0.0.1 --port ${previewPort}`
				: `pnpm exec vite preview --port ${previewPort}`,
		url: baseURL,
		timeout: 180 * 1000,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'tests',
	outputDir: 'tests/results',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 1,
	workers: process.env.CI ? 1 : 1,
	globalTimeout: 120 * 60 * 1000,
	timeout: 100 * 1000,
	expect: {
		timeout: 20 * 1000
	},
	reporter: [
		[process.env.CI ? 'github' : 'list'],
		[
			'html',
			{
				open: process.env.CI ? 'never' : process.env.DOCKER ? 'always' : 'on-failure',
				outputFolder: 'tests/reports',
				host: process.env.DOCKER ? '0.0.0.0' : 'localhost'
			}
		]
	],
	use: {
		baseURL,
		screenshot: 'only-on-failure',
		video: process.env.CI ? 'retain-on-failure' : 'on',
		trace: process.env.CI ? 'retain-on-failure' : 'on',
		contextOptions: {
			recordVideo: { dir: 'tests/results/videos' }
		}
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] }
		}
		// {
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] },
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] },
		// }
	]
};

export default config;
