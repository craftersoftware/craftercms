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

/** Body shown in the unlock error dialog. Matches `ApiResponse` without importing the app graph. */
export interface UnlockErrorBody {
	code?: number | string;
	message?: string;
	remedialAction?: string;
	documentationUrl?: string;
}

/**
 * What is known about the lock when a form is going away.
 * Draft, invalid, and saved-as-draft are not inputs: closing releases the lock anyway.
 * An unsaved file-name edit is not a rename — `lockedPath` stays the path that was locked.
 * `releaseLockOnClose` is the user's "Release lock when closing" choice, read when the form goes away.
 */
export interface UnlockOnCloseState {
	isRepeatMode: boolean;
	isCreateMode: boolean;
	readonly: boolean;
	isEmbedded: boolean;
	isStackedForm: boolean;
	isParentReadonly: boolean;
	siteId: string;
	/**
	 * When false, close and pagehide keep the lock. The Release Lock button does not use this.
	 * Defaults to releasing when omitted.
	 */
	releaseLockOnClose?: boolean;
	/** Path recorded from the successful lock, updated when a saved rename moves the lock. */
	lockedPath: string | null;
}

export interface HeldLockRecord {
	locked: boolean;
	lockedPath?: string | null;
}

/**
 * Whether this form should release a lock it holds.
 * Repeat items share the parent lock. Create mode never takes one. Readonly did not take one
 * (or already released it). An embedded form stacked on an editable parent uses that parent's lock.
 * An embedded form stacked on a readonly parent locks the item itself and must release it.
 */
export function shouldUnlockItem(state: UnlockOnCloseState): boolean {
	if (!state.lockedPath) return false;
	// The user asked to keep the lock. Minimize never reaches this: the form stays mounted.
	if (state.releaseLockOnClose === false) return false;
	return (
		!state.isRepeatMode &&
		!state.isCreateMode &&
		!state.readonly &&
		// Not embedded: this form holds the lock.
		(!state.isEmbedded ||
			// Embedded but not stacked: it is the root form.
			!state.isStackedForm ||
			// Stacked on a readonly parent: this form took the lock and must put the parent back.
			state.isParentReadonly)
	);
}

/** Path to unlock, or null when this close must leave the lock alone. */
export function lockPathToRelease(state: UnlockOnCloseState): string | null {
	return shouldUnlockItem(state) ? state.lockedPath : null;
}

/**
 * A saved move updates the same item row to `nextPath`. `locked_by` stays on that row, but
 * `ItemDAO.moveItem` clears the USER_LOCKED state bit, so the server-side lock after a rename
 * is weaker than a normal user lock. Unlock the new path. The old path no longer exists.
 * Returns null when this form is not holding a lock.
 */
export function applySavedRenameToLock(
	current: HeldLockRecord,
	nextPath: string
): Pick<HeldLockRecord, 'lockedPath'> | null {
	if (!current.locked && !current.lockedPath) return null;
	return { lockedPath: nextPath };
}

/**
 * Pushing a deeper stacked form unmounts the covered form while its entry stays in the stack.
 * That unmount must not release the lock. Popping the entry, or unmounting the top form, still does.
 * pagehide is a real leave, so it is not skipped.
 */
export function keepLockOnStackedUnmount(args: {
	via: 'pagehide' | 'unmount';
	isStackedForm: boolean;
	entryStillOnStack: boolean;
	coveredByDeeperForm: boolean;
}): boolean {
	return args.via === 'unmount' && args.isStackedForm && args.entryStillOnStack && args.coveredByDeeperForm;
}

/**
 * Root reload pops every stacked form. The mounted top releases itself on unmount.
 * Covered entries have no bootstrap, so they are released here instead.
 */
export function entriesReleasedOnStackRemoval<T>(args: {
	stack: readonly T[];
	closeCount: number;
	mounted: T | null;
}): T[] {
	const remaining = args.stack.slice();
	const released: T[] = [];
	const count = Math.min(Math.max(args.closeCount, 0), remaining.length);
	for (let i = 0; i < count; i++) {
		const entry = remaining.pop();
		if (entry != null && entry !== args.mounted) released.push(entry);
	}
	return released;
}

/**
 * One root-form session. A path may be locked again after it was released, so dedup is the
 * stack entry (that acquisition), not the path. pagehide and unmount share the entry.
 * Parent readonly is remembered before a mounted entry is popped: its unmount runs after
 * root reload has already removed the parent.
 */
export interface FormLockReleaseSession {
	rememberParentReadonly(entry: object, parentReadonly: boolean): void;
	parentReadonly(entry: object, liveParentReadonly: boolean): boolean;
	/** Sends the unlock on the first call for this entry. Later calls return null. */
	releaseOnce(entry: object, state: UnlockOnCloseState, send: (path: string) => void): string | null;
}

export function createFormLockReleaseSession(): FormLockReleaseSession {
	const released = new WeakSet<object>();
	const parentReadonlyByEntry = new WeakMap<object, boolean>();
	return {
		rememberParentReadonly(entry, parentReadonly) {
			if (!parentReadonlyByEntry.has(entry)) parentReadonlyByEntry.set(entry, parentReadonly);
		},
		parentReadonly(entry, liveParentReadonly) {
			const remembered = parentReadonlyByEntry.get(entry);
			return remembered !== undefined ? remembered : liveParentReadonly;
		},
		releaseOnce(entry, state, send) {
			const path = lockPathToRelease(state);
			if (!path) return null;
			if (released.has(entry)) return null;
			released.add(entry);
			send(path);
			return path;
		}
	};
}

/**
 * One pop during close or root reload, before the entry is removed.
 * A covered entry is released now. The mounted top is only marked, because it unmounts later.
 */
export function prepareStackedFormPop<T extends object>(args: {
	stack: readonly T[];
	mounted: T | null;
	session: FormLockReleaseSession;
	parentReadonly(parent: T): boolean;
	releaseCovered(entry: T): void;
}): { mounted: T | null } {
	const removed = args.stack[args.stack.length - 1];
	if (!removed) return { mounted: args.mounted };
	const [covered] = entriesReleasedOnStackRemoval({
		stack: args.stack,
		closeCount: 1,
		mounted: args.mounted
	});
	if (covered) {
		args.releaseCovered(covered);
		return { mounted: args.mounted };
	}
	const index = args.stack.lastIndexOf(removed);
	const parent = index > 0 ? args.stack[index - 1] : undefined;
	args.session.rememberParentReadonly(removed, parent ? args.parentReadonly(parent) : false);
	return { mounted: null };
}

const storedAtomsByKey = new Map<string, unknown>();

/** One atom per storage key. Stacked forms and the root then share the per-user value in one store. */
export function sharedPerUserAtom<T>(key: string, create: () => T): T {
	const existing = storedAtomsByKey.get(key);
	if (existing !== undefined) return existing as T;
	const created = create();
	storedAtomsByKey.set(key, created);
	return created;
}

/** Payload for the error dialog. Keeps the API body when the server sent one. */
export function unlockErrorPayload(error: {
	status?: number;
	message?: string;
	response?: { response?: UnlockErrorBody; message?: string } | UnlockErrorBody | null;
}): UnlockErrorBody {
	const response = error.response;
	if (response && typeof response === 'object') {
		const nested = (response as { response?: UnlockErrorBody }).response;
		if (nested && typeof nested === 'object') return nested;
		if ('message' in response || 'code' in response) return response as UnlockErrorBody;
	}
	return {
		code: error.status,
		message: error.message || 'An error occurred unlocking the item.'
	};
}

/** Release Lock failed when the unlock call came back with an error. */
export function releaseLockToggleFailed(result: { lockError?: UnlockErrorBody | null }): boolean {
	return result.lockError != null;
}

export interface LockReleaseGate {
	/** True the first time a release is claimed. Later calls are false so close and pagehide do not both unlock. */
	claim(): boolean;
}

export function createLockReleaseGate(): LockReleaseGate {
	let released = false;
	return {
		claim() {
			if (released) return false;
			released = true;
			return true;
		}
	};
}

/**
 * Claims the single release for this form and returns the path to unlock.
 * A call that has nothing to unlock does not claim, so a later call still can.
 */
export function planLockRelease(state: UnlockOnCloseState, gate: LockReleaseGate): string | null {
	const path = lockPathToRelease(state);
	if (!path) return null;
	if (!gate.claim()) return null;
	return path;
}

/** `fetch` options for an unlock that must survive the document going away. */
export function unlockKeepaliveInit(
	siteId: string,
	path: string,
	headers: Record<string, string> = {}
): { url: string; init: RequestInit } {
	return {
		url: `/studio/api/2/content/${siteId}/item_unlock_by_path`,
		init: {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...headers },
			body: JSON.stringify({ path }),
			keepalive: true,
			credentials: 'same-origin'
		}
	};
}

/**
 * pagehide also fires when the page is frozen into the back/forward cache.
 * The form is still open if the user comes back, so that case must not release the lock.
 */
export function shouldUnlockOnPageHide(event: { persisted?: boolean }): boolean {
	return !event.persisted;
}

/** Best-effort unlock for pagehide. Failures are not surfaced; the page is going away. */
export function postUnlockKeepalive(siteId: string, path: string, headers: Record<string, string> = {}): void {
	if (typeof fetch !== 'function') return;
	const { url, init } = unlockKeepaliveInit(siteId, path, headers);
	try {
		void fetch(url, init).catch(() => {
			// The document is unloading. There is nowhere to report this.
		});
	} catch {
		// fetch itself rejected synchronously.
	}
}
