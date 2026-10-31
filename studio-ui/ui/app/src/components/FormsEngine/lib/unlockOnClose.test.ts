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

/**
 * Covers which close releases the item lock.
 * Save Draft, invalid fields, a saved-as-draft item, and an unsaved file-name edit used to
 * skip the unlock. A saved rename unlocks the path the lock moved to. Repeat, create,
 * readonly, and an embedded form on an editable parent do not unlock. pagehide and unmount
 * share one release.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	applySavedRenameToLock,
	createLockReleaseGate,
	createFormLockReleaseSession,
	entriesReleasedOnStackRemoval,
	keepLockOnStackedUnmount,
	lockPathToRelease,
	planLockRelease,
	prepareStackedFormPop,
	releaseLockToggleFailed,
	sharedPerUserAtom,
	shouldUnlockOnPageHide,
	unlockErrorPayload,
	unlockKeepaliveInit,
	type FormLockReleaseSession,
	type UnlockOnCloseState
} from './unlockOnClose.ts';
import { stackedFormsClosedByReload } from './formVisibility.ts';

const article = '/site/website/articles/hello/index.xml';
const renamed = '/site/website/articles/hello-world/index.xml';

function holding(lockedPath: string | null, overrides: Partial<UnlockOnCloseState> = {}): UnlockOnCloseState {
	return {
		isRepeatMode: false,
		isCreateMode: false,
		readonly: false,
		isEmbedded: false,
		isStackedForm: false,
		isParentReadonly: false,
		siteId: 'editorial',
		lockedPath,
		releaseLockOnClose: true,
		...overrides
	};
}

describe('lock released on close', () => {
	const cases: Array<[string, UnlockOnCloseState, string | null]> = [
		['normal save and close', holding(article), article],
		['close without changes', holding(article), article],
		// Draft, invalid, and saved-as-draft are not inputs. The close is the same as a normal close.
		['after Save Draft', holding(article), article],
		['with invalid fields', holding(article), article],
		['on an item flagged saved-as-draft', holding(article), article],
		// An unsaved file-name edit does not move the lock. The recorded path is still the original.
		['with an unsaved file-name edit', holding(article), article],
		['with no lock recorded', holding(null), null],
		['in create mode', holding(article, { isCreateMode: true }), null],
		['in readonly mode', holding(article, { readonly: true }), null],
		['for a repeat item', holding(article, { isRepeatMode: true }), null],
		[
			'for an embedded form stacked on an editable parent',
			holding(article, { isEmbedded: true, isStackedForm: true }),
			null
		],
		[
			'for an embedded form stacked on a readonly parent',
			holding(article, { isEmbedded: true, isStackedForm: true, isParentReadonly: true }),
			article
		],
		['for an embedded form that is the root', holding(article, { isEmbedded: true, isStackedForm: false }), article],
		['for a stacked form that holds its own lock', holding(article, { isStackedForm: true }), article]
	];

	for (const [name, state, expected] of cases) {
		it(name, () => {
			assert.equal(lockPathToRelease(state), expected);
		});
	}

	it('follows a saved rename to the path that is locked', () => {
		const followed = applySavedRenameToLock({ locked: true, lockedPath: article }, renamed);
		assert.ok(followed);
		assert.equal(followed.lockedPath, renamed);
		assert.equal(lockPathToRelease(holding(followed.lockedPath)), renamed);
	});

	it('follows a second saved rename to the newest path', () => {
		const first = applySavedRenameToLock({ locked: true, lockedPath: article }, renamed);
		const second = applySavedRenameToLock(
			{ locked: true, lockedPath: first.lockedPath },
			'/site/website/articles/final/index.xml'
		);
		assert.equal(second.lockedPath, '/site/website/articles/final/index.xml');
	});

	it('does not record a move when this form is not holding a lock', () => {
		assert.equal(applySavedRenameToLock({ locked: false, lockedPath: null }, renamed), null);
	});
});

describe('covered stacked form', () => {
	it('keeps the lock when a deeper form unmounts it but the entry is still on the stack', () => {
		assert.equal(
			keepLockOnStackedUnmount({
				via: 'unmount',
				isStackedForm: true,
				entryStillOnStack: true,
				coveredByDeeperForm: true
			}),
			true
		);
	});

	it('releases the lock after the entry is popped', () => {
		assert.equal(
			keepLockOnStackedUnmount({
				via: 'unmount',
				isStackedForm: true,
				entryStillOnStack: false,
				coveredByDeeperForm: false
			}),
			false
		);
	});

	it('releases the top stacked form when it unmounts', () => {
		assert.equal(
			keepLockOnStackedUnmount({
				via: 'unmount',
				isStackedForm: true,
				entryStillOnStack: true,
				coveredByDeeperForm: false
			}),
			false
		);
	});

	it('still unlocks on pagehide while the entry is covered', () => {
		assert.equal(
			keepLockOnStackedUnmount({
				via: 'pagehide',
				isStackedForm: true,
				entryStillOnStack: true,
				coveredByDeeperForm: true
			}),
			false
		);
	});
});

describe('root reload of stacked forms', () => {
	it('releases covered locks and leaves the mounted top to its own unmount', () => {
		const covered = holding('/site/components/covered.xml');
		const top = holding('/site/components/top.xml');
		const stack = [{ id: 'root' }, { id: 'covered', state: covered }, { id: 'top', state: top }];
		const mounted = stack[2];
		// A root reload closes every stacked form: stack length minus the root.
		const released = entriesReleasedOnStackRemoval({
			stack,
			closeCount: stack.length - 1,
			mounted
		});
		assert.deepEqual(
			released.map((entry) => entry.id),
			['covered']
		);
		assert.equal(lockPathToRelease(covered), '/site/components/covered.xml');
		assert.equal(lockPathToRelease({ ...covered, releaseLockOnClose: false }), null);
	});
});

describe('shared release-lock setting', () => {
	it('reuses one atom per user so a stacked form and the root read the same value', () => {
		const user = `author-${Date.now()}`;
		const otherUser = `${user}-other`;
		const created: string[] = [];
		const root = sharedPerUserAtom(user, () => {
			created.push(user);
			return { id: 'root' };
		});
		const stacked = sharedPerUserAtom(user, () => {
			throw new Error('a second atom must not be created');
		});
		const other = sharedPerUserAtom(otherUser, () => ({ id: 'other' }));
		assert.equal(root, stacked);
		assert.notEqual(root, other);
		assert.deepEqual(created, [user]);
	});
});

describe('release lock when closing', () => {
	const keepLock = holding(article, { releaseLockOnClose: false });

	it('keeps the lock on close when the choice is off', () => {
		assert.equal(lockPathToRelease(keepLock), null);
	});

	it('keeps the lock on pagehide when the choice is off', () => {
		const gate = createLockReleaseGate();
		assert.equal(shouldUnlockOnPageHide({ persisted: false }), true);
		assert.equal(planLockRelease(keepLock, gate), null);
		// The choice did not spend the release. Turning it back on still unlocks.
		assert.equal(planLockRelease(holding(article), gate), article);
	});

	it('keeps the lock when close-after-save unmounts and the choice is off', () => {
		// Close after saving unmounts through the same decision as any other close.
		assert.equal(lockPathToRelease(keepLock), null);
		assert.equal(lockPathToRelease(holding(article, { releaseLockOnClose: true })), article);
	});
});

describe('unlock errors', () => {
	it('keeps the API body and falls back to the error message', () => {
		assert.deepEqual(unlockErrorPayload({ response: { response: { message: 'Locked by someone else' } } }), {
			message: 'Locked by someone else'
		});
		assert.deepEqual(unlockErrorPayload({ status: 500, message: 'network' }), {
			code: 500,
			message: 'network'
		});
	});

	it('treats a Release Lock failure as an error and a clean unlock as success', () => {
		assert.equal(releaseLockToggleFailed({ lockError: { message: 'nope' } }), true);
		assert.equal(releaseLockToggleFailed({ lockError: null }), false);
		assert.equal(releaseLockToggleFailed({}), false);
	});
});

interface ReloadEntry {
	readonly: boolean;
	path: string;
	embedded: boolean;
}

/** Root reload: pop every stacked entry the way FormsEngine does, then unmount whatever was mounted. */
function reloadRootStack(session: FormLockReleaseSession, stack: ReloadEntry[], unlocks: string[]): void {
	let mounted: ReloadEntry | null = stack[stack.length - 1] ?? null;
	const mountedAtStart = mounted;
	const closeCount = stackedFormsClosedByReload(stack.length, 0);
	const releaseEntry = (entry: ReloadEntry, liveParentReadonly: boolean) => {
		const state = holding(entry.path, {
			readonly: entry.readonly,
			isEmbedded: entry.embedded,
			isStackedForm: true,
			isParentReadonly: session.parentReadonly(entry, liveParentReadonly)
		});
		// pagehide and unmount share this acquisition.
		session.releaseOnce(entry, state, (path) => unlocks.push(path));
		session.releaseOnce(entry, state, (path) => unlocks.push(path));
	};
	for (let n = 0; n < closeCount; n++) {
		const next = prepareStackedFormPop({
			stack,
			mounted,
			session,
			parentReadonly: (parent) => parent.readonly,
			releaseCovered: (entry) => {
				const index = stack.lastIndexOf(entry);
				const parent = index > 0 ? stack[index - 1] : undefined;
				releaseEntry(entry, parent ? parent.readonly : false);
			}
		});
		mounted = next.mounted;
		stack.pop();
	}
	if (!mountedAtStart || mountedAtStart === stack[0]) return;
	// The mounted top unmounts after the parent has left the stack. Live parent readonly is gone.
	releaseEntry(mountedAtStart, false);
}

describe('root session lock acquisitions', () => {
	it('unlocks the same path once per acquisition across two cover and root-reload cycles', () => {
		const session = createFormLockReleaseSession();
		const unlocks: string[] = [];
		const cycle = () => {
			reloadRootStack(
				session,
				[
					{ readonly: false, path: '/site/website/index.xml', embedded: false },
					{ readonly: false, path: article, embedded: false },
					{ readonly: false, path: '/site/components/cover.xml', embedded: true }
				],
				unlocks
			);
		};
		cycle();
		cycle();
		assert.deepEqual(unlocks, [article, article]);
	});

	it('releases an embedded lock taken under a readonly parent once when root reload pops both', () => {
		const session = createFormLockReleaseSession();
		const unlocks: string[] = [];
		const embeddedPath = '/site/components/embedded.xml';
		reloadRootStack(
			session,
			[
				{ readonly: false, path: '/site/website/index.xml', embedded: false },
				{ readonly: true, path: '/site/components/parent.xml', embedded: false },
				{ readonly: false, path: embeddedPath, embedded: true }
			],
			unlocks
		);
		assert.deepEqual(unlocks, [embeddedPath]);
	});

	it('does not release a lock borrowed from an editable parent', () => {
		const session = createFormLockReleaseSession();
		const unlocks: string[] = [];
		const parentPath = '/site/website/index.xml';
		reloadRootStack(
			session,
			[
				{ readonly: false, path: parentPath, embedded: false },
				{ readonly: false, path: parentPath, embedded: true }
			],
			unlocks
		);
		assert.deepEqual(unlocks, []);
	});

	it('still skips a repeat item and a lock the author chose to keep', () => {
		const session = createFormLockReleaseSession();
		const unlocks: string[] = [];
		const repeat = {};
		const kept = {};
		session.releaseOnce(repeat, holding(article, { isRepeatMode: true }), (path) => unlocks.push(path));
		session.releaseOnce(kept, holding(article, { releaseLockOnClose: false }), (path) => unlocks.push(path));
		assert.deepEqual(unlocks, []);
	});
});

describe('one release per form', () => {
	it('lets pagehide claim the release so unmount does not unlock again', () => {
		const gate = createLockReleaseGate();
		const state = holding(article);
		assert.equal(planLockRelease(state, gate), article);
		assert.equal(planLockRelease(state, gate), null);
	});

	it('does not spend the release when this close should not unlock', () => {
		const gate = createLockReleaseGate();
		assert.equal(planLockRelease(holding(article, { readonly: true }), gate), null);
		assert.equal(planLockRelease(holding(article), gate), article);
	});

	it('does not unlock on pagehide when the page is only frozen', () => {
		assert.equal(shouldUnlockOnPageHide({ persisted: true }), false);
		assert.equal(shouldUnlockOnPageHide({ persisted: false }), true);
		assert.equal(shouldUnlockOnPageHide({}), true);
	});

	it('posts the unlock with keepalive for the locked path', () => {
		const { url, init } = unlockKeepaliveInit('editorial', article, { Authorization: 'Bearer t' });
		assert.equal(url, '/studio/api/2/content/editorial/item_unlock_by_path');
		assert.equal(init.method, 'POST');
		assert.equal(init.keepalive, true);
		assert.equal(init.credentials, 'same-origin');
		assert.deepEqual(JSON.parse(String(init.body)), { path: article });
		const headers = init.headers as Record<string, string>;
		assert.equal(headers['Content-Type'], 'application/json');
		assert.equal(headers.Authorization, 'Bearer t');
	});
});
