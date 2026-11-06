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
	await settle(page, 'preview', page.getByRole('button', { name: 'Options (a)' }));
	await expect(page.getByRole('button', { name: 'Options (a)' })).toBeEnabled();
}

/**
 * Opens an item menu entry that leads to a dialog. The dialog's `role="dialog"` node mounts before its body, so the
 * ready condition is the dialog's own content: a heading, plus the first field for forms.
 */
async function openItemMenuOption(page: Page, name: string, screen: string, content: Locator) {
	await page.getByRole('button', { name: 'Options (a)' }).click();
	await page.getByRole('menuitem', { name, exact: true }).click();
	await settle(page, screen, content);
}

/** What a tools panel page shows once it has rendered: a dialog, or the page itself behind a Back button. */
function panelPageReady(page: Page, panel: Locator) {
	return page.getByRole('dialog').or(panel.getByRole('button', { name: 'Back' }));
}

/** Scans a tools panel as it opens and then every page or dialog its top level buttons lead to. */
async function checkPanelPages(page: Page, testInfo: Parameters<typeof checkA11y>[1], panel: Locator, name: string) {
	await expect(panel).toBeVisible();
	await settle(page, name, panel.locator('.MuiListItemButton-root').first());
	await checkA11y(page, testInfo, name);
	const buttons = panel.locator('.MuiListItemButton-root');
	const labels: string[] = [];
	for (let i = 0, count = await buttons.count(); i < count; i++) {
		labels.push((await buttons.nth(i).innerText()).split('\n')[0]);
	}
	for (const label of labels) {
		await panel.locator('.MuiListItemButton-root', { hasText: label }).first().click();
		const screen = `${name} > ${label}`;
		const body = panel.locator('section').last();
		await settle(page, screen, panelPageReady(page, panel), body);
		await checkA11y(page, testInfo, screen);
		const dialog = page.getByRole('dialog');
		if (await dialog.count()) {
			await page.keyboard.press('Escape');
			await expect(dialog).toHaveCount(0);
			continue;
		}
		const back = panel.getByRole('button', { name: 'Back' });
		if (await back.count()) {
			await back.first().click();
			await settle(page, name, panel.locator('.MuiListItemButton-root').first());
		}
	}
}

test.describe('Login', () => {
	test.use({ authenticated: false });
	test('login', async ({ page }, testInfo) => {
		await page.goto('/studio/login');
		await settle(page, 'login', page.locator('input[name="username"]'));
		await checkA11y(page, testInfo, 'login');
	});
});

test.describe('Global app', () => {
	test('projects', async ({ page }, testInfo) => {
		await page.goto('/studio/#/projects');
		await settle(page, 'projects', page.getByRole('button', { name: 'Create Project' }));
		await checkA11y(page, testInfo, 'projects');
	});

	test('users', async ({ page }, testInfo) => {
		await page.goto('/studio/#/users');
		await settle(page, 'users', page.getByRole('grid').or(page.getByRole('table')).first());
		await checkA11y(page, testInfo, 'users');
	});

	test('create project', async ({ page }, testInfo) => {
		await page.goto('/studio/#/projects');
		await page.getByRole('button', { name: 'Create Project' }).click();
		await settle(page, 'create project', page.getByRole('dialog'));
		await checkA11y(page, testInfo, 'create project');
	});
});

test.describe('Project screens', () => {
	test('dashboard', async ({ page }, testInfo) => {
		await page.goto('/studio/site-dashboard');
		await settle(page, 'dashboard', page.getByText('Unpublished Work'));
		await checkA11y(page, testInfo, 'dashboard');
	});

	test('site tools', async ({ page }, testInfo) => {
		await page.goto('/studio/site-config');
		// The tool list is a menu; with no tools configured it holds the empty state instead.
		await settle(page, 'site tools', page.getByRole('menu'));
		await checkA11y(page, testInfo, 'site tools');
	});

	test('search', async ({ page }, testInfo) => {
		await page.goto('/studio/search');
		await settle(page, 'search', page.getByRole('heading', { name: 'Search', level: 2 }));
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
		const dialog = page.getByRole('dialog');
		await openItemMenuOption(page, 'Edit', 'edit form', dialog.locator('[data-field-id]').first());
		await checkA11y(page, testInfo, 'edit form');
	});

	test('publish dialog', async ({ page }, testInfo) => {
		await openPreview(page);
		await openItemMenuOption(
			page,
			'Publish',
			'publish dialog',
			page.getByRole('heading', { name: 'Publish', level: 2 })
		);
		await checkA11y(page, testInfo, 'publish dialog');
	});
});
