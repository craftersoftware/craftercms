/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Locator, Page } from '@playwright/test';
import { checkA11y } from './axe';
import { expect, settle, test } from './fixtures';
import { previewPage, project } from './env';

// The drawer root is always laid out; the paper is what becomes hidden when the panel is closed.
const leftPanel = (page: Page) => page.locator('.MuiDrawer-docked.MuiDrawer-anchorLeft > .MuiDrawer-paper');
const rightPanel = (page: Page) => page.locator('.MuiDrawer-docked.MuiDrawer-anchorRight > .MuiDrawer-paper');

async function openPreview(page: Page) {
	await page.goto(`/studio/preview#/?page=${encodeURIComponent(previewPage)}&site=${project}`);
	await expect(page.getByRole('button', { name: 'Open tools panel' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Options (a)' })).toBeEnabled({ timeout: 30_000 });
	await settle(page);
}

async function openItemMenuOption(page: Page, name: string) {
	await page.getByRole('button', { name: 'Options (a)' }).click();
	await page.getByRole('menuitem', { name, exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await settle(page);
}

/** Scans a tools panel as it opens and then every page or dialog its top level buttons lead to. */
async function checkPanelPages(page: Page, testInfo: Parameters<typeof checkA11y>[1], panel: Locator, name: string) {
	await expect(panel).toBeVisible();
	await settle(page);
	await checkA11y(page, testInfo, name, 'preview');
	const buttons = panel.locator('.MuiListItemButton-root');
	const labels: string[] = [];
	for (let i = 0, count = await buttons.count(); i < count; i++) {
		labels.push((await buttons.nth(i).innerText()).split('\n')[0]);
	}
	for (const label of labels) {
		await panel.locator('.MuiListItemButton-root', { hasText: label }).first().click();
		await settle(page);
		await checkA11y(page, testInfo, `${name} > ${label}`, 'preview');
		const dialog = page.getByRole('dialog');
		if (await dialog.count()) {
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			continue;
		}
		const back = panel.getByRole('button', { name: 'Back' });
		if (await back.count()) await back.first().click();
	}
}

test.describe('Login', () => {
	test.use({ authenticated: false });
	test('login', async ({ page }, testInfo) => {
		await page.goto('/studio/login');
		await expect(page.locator('input[name="username"]')).toBeVisible();
		await settle(page);
		await checkA11y(page, testInfo, 'login');
	});
});

test.describe('Global app', () => {
	test('projects', async ({ page }, testInfo) => {
		await page.goto('/studio/#/projects');
		await expect(page.getByRole('button', { name: 'Create Project' })).toBeVisible();
		await settle(page);
		await checkA11y(page, testInfo, 'projects');
	});

	test('users', async ({ page }, testInfo) => {
		await page.goto('/studio/#/users');
		await settle(page);
		await expect(page.getByRole('grid').or(page.getByRole('table')).first()).toBeVisible();
		await checkA11y(page, testInfo, 'users');
	});

	test('create project', async ({ page }, testInfo) => {
		await page.goto('/studio/#/projects');
		await page.getByRole('button', { name: 'Create Project' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await settle(page);
		await checkA11y(page, testInfo, 'create project');
	});
});

test.describe('Project screens', () => {
	test('dashboard', async ({ page }, testInfo) => {
		await page.goto('/studio/site-dashboard');
		await settle(page);
		await checkA11y(page, testInfo, 'dashboard');
	});

	test('site tools', async ({ page }, testInfo) => {
		await page.goto('/studio/site-config');
		await settle(page);
		await checkA11y(page, testInfo, 'site tools');
	});

	test('search', async ({ page }, testInfo) => {
		await page.goto('/studio/search');
		await settle(page);
		await checkA11y(page, testInfo, 'search');
	});
});

test.describe('Preview', () => {
	test('preview', async ({ page }, testInfo) => {
		await openPreview(page);
		await checkA11y(page, testInfo, 'preview');
	});

	test('tools panel', async ({ page }, testInfo) => {
		await openPreview(page);
		if (!(await leftPanel(page).isVisible())) {
			await page.getByRole('button', { name: 'Open tools panel' }).click();
		}
		await checkPanelPages(page, testInfo, leftPanel(page), 'tools panel');
	});

	test('edit mode tools panel', async ({ page }, testInfo) => {
		await openPreview(page);
		if (!(await rightPanel(page).isVisible())) {
			await page.locator('input.MuiSwitch-input').first().check({ force: true });
		}
		await checkPanelPages(page, testInfo, rightPanel(page), 'edit mode tools panel');
	});

	test('edit form', async ({ page }, testInfo) => {
		await openPreview(page);
		await openItemMenuOption(page, 'Edit');
		await checkA11y(page, testInfo, 'edit form');
	});

	test('publish dialog', async ({ page }, testInfo) => {
		await openPreview(page);
		await openItemMenuOption(page, 'Publish');
		await checkA11y(page, testInfo, 'publish dialog');
	});
});
