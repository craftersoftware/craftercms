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

import '../../../../test/stringListDomSetup.mjs';
import '../../../../test/registerTsLoader.mjs';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

Object.defineProperty(globalThis, 'ShadowRoot', { value: window.ShadowRoot, configurable: true, writable: true });

const React = await import('react');
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { RawIntlProvider, createIntl } = await import('react-intl');
const { accessibleName } = await import('../../../../test/accessibleName.ts');
const { MoveToFieldDialog } = await import('./MoveToFieldDialog.tsx');

const intl = createIntl({ locale: 'en', messages: {}, onError: () => undefined });

const destinations = [
	{
		modelId: 'page-1',
		fieldId: 'right_o',
		labelPath: 'Right Rail',
		items: [{ key: 'a', value: 'Alpha' }],
		currentCount: 1,
		maxCount: null,
		disabled: false
	},
	{
		modelId: 'page-1',
		fieldId: 'locked_o',
		labelPath: 'Locked',
		items: [],
		currentCount: 0,
		maxCount: null,
		disabled: true,
		reason: 'readonly'
	}
];

const mounted: Array<{ unmount(): void; host: HTMLElement }> = [];
afterEach(async () => {
	await act(async () => {
		for (const { unmount, host } of mounted.splice(0)) {
			unmount();
			host.remove();
		}
	});
});

async function renderDialog(props: Record<string, unknown>) {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	mounted.push({ unmount: () => root.unmount(), host });
	await act(async () => {
		root.render(
			React.createElement(
				RawIntlProvider,
				{ value: intl },
				React.createElement(MoveToFieldDialog, {
					open: true,
					itemLabel: 'Hero',
					targets: [],
					onClose() {},
					...props
				} as never)
			)
		);
	});
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
	return host;
}

describe('MoveToFieldDialog', () => {
	it('lists destinations, disables invalid ones with a reason, and enables position after a valid pick', async () => {
		const accepted: Array<{ modelId: string; fieldId: string; targetIndex: number }> = [];
		await renderDialog({
			targets: destinations,
			onAccept(target, targetIndex) {
				accepted.push({ modelId: target.modelId, fieldId: target.fieldId, targetIndex });
			}
		});

		const dialog = document.body.querySelector('.MuiDialog-root');
		assert.ok(dialog);
		assert.match(dialog.textContent ?? '', /Right Rail/);
		assert.match(dialog.textContent ?? '', /Locked/);
		assert.match(dialog.textContent ?? '', /Field is read-only/);
		assert.match(dialog.textContent ?? '', /Insert last/);

		const locked = Array.from(dialog.querySelectorAll('.MuiListItemButton-root')).find(
			(button) => (button as HTMLButtonElement).disabled || button.getAttribute('aria-disabled') === 'true'
		);
		assert.ok(locked);
		assert.match(locked.textContent ?? '', /Locked/);

		const move = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === 'Move');
		assert.ok(move);
		assert.equal((move as HTMLButtonElement).disabled, false);
		await act(async () => {
			(move as HTMLButtonElement).click();
		});
		assert.deepEqual(accepted, [{ modelId: 'page-1', fieldId: 'right_o', targetIndex: 1 }]);
	});

	it('names the dialog and the destination list, and marks the selected destination as pressed', async () => {
		await renderDialog({ targets: destinations });

		const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
		assert.ok(dialog);
		assert.equal(accessibleName(dialog), 'Move Hero to field');

		const destinationList = Array.from(dialog.querySelectorAll<HTMLElement>('.MuiList-root')).find(
			(list) => accessibleName(list) === 'Destination field'
		);
		assert.ok(destinationList, 'destination list is not named by aria-labelledby');

		const buttons = Array.from(destinationList.querySelectorAll<HTMLElement>('.MuiListItemButton-root'));
		const rightRail = buttons.find((button) => button.textContent?.includes('Right Rail'));
		const locked = buttons.find((button) => button.textContent?.includes('Locked'));
		assert.ok(rightRail);
		assert.ok(locked);
		assert.equal(rightRail.getAttribute('aria-pressed'), 'true');
		assert.equal(locked.getAttribute('aria-pressed'), 'false');
	});

	it('shows an empty state when there are no destinations', async () => {
		await renderDialog({ targets: [] });
		const dialog = document.body.querySelector('.MuiDialog-root');
		assert.match(dialog?.textContent ?? '', /No compatible fields/);
		const move = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === 'Move');
		assert.equal((move as HTMLButtonElement).disabled, true);
	});
});
