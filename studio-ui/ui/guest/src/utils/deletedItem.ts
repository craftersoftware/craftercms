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

export interface DeletedItemRemoval {
	/** The registry record of the deleted item. */
	record: { id: string | number; element: Element };
	deregister(id: string | number): void;
	/** The registry id of a registered descendant of the deleted item. */
	idOf(element: Element): string | number;
	/** Called once the item is out of the DOM, to re-index its siblings. */
	reindex(parent: Element): void;
}

/**
 * Removes a deleted item on the next task. Immediate removal of the element causes the dragend event not to
 * fire, leaving the state corrupt (in a state of "SORTING"). The deregister and the sibling re-index run in
 * that same task so the zone keyboard controls, which group registry changes per animation frame, never see
 * the item gone with its siblings not yet re-indexed.
 */
export function scheduleDeletedItemRemoval({ record, deregister, idOf, reindex }: DeletedItemRemoval): void {
	setTimeout(() => {
		deregister(record.id);
		// de-register all registered children of the deleted item (if exist)
		record.element.querySelectorAll('[data-craftercms-model-id]').forEach((el) => {
			deregister(idOf(el));
		});
		const parent = record.element.parentElement;
		record.element.remove();
		reindex(parent);
	});
}
