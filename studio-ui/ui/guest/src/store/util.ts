/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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

import { SyntheticEvent } from 'react';
import { EditingStatus } from '../constants';
import { fetchContentItem, lock } from '@craftercms/studio-ui/services/content';
import { catchError, concatMap, defaultIfEmpty, filter, map, switchMap, take, takeWhile, tap } from 'rxjs/operators';
import { message$, post } from '../utils/communicator';
import {
	requestWorkflowCancellationDialog,
	requestWorkflowCancellationDialogOnResult,
	snackGuestMessage
} from '@craftercms/studio-ui/state/actions/preview';
import { unlockItem } from '@craftercms/studio-ui/state/actions/content';
import { EMPTY, forkJoin, from, Observable, of } from 'rxjs';
import { ContentItem } from '@craftercms/studio-ui/models';
import { GuestState } from './models/GuestStore';
import { ElementRecord, ICERecord } from '../models/InContextEditing';
import { getCachedContentItem, getCachedModel, getCachedModels, modelHierarchyMap } from '../contentController';
import { getParentModelId } from '../utils/ice';
import { getReferentialEntries } from '../iceRegistry';
import { extractCollectionItem } from '@craftercms/studio-ui/utils/model';
import { cancelPackages, fetchAffectedPackages } from '@craftercms/studio-ui/services/workflow';

export function dragOk(status): boolean {
	return [
		EditingStatus.SORTING_COMPONENT,
		EditingStatus.PLACING_NEW_COMPONENT,
		EditingStatus.PLACING_DETACHED_ASSET,
		EditingStatus.PLACING_DETACHED_COMPONENT,
		EditingStatus.UPLOAD_ASSET_FROM_DESKTOP
	].includes(status);
}

export function unwrapEvent<T extends Event>(event: SyntheticEvent | Event): T {
	// @ts-ignore
	return event?.originalEvent ?? event?.nativeEvent ?? event;
}

export interface BeforeWriteProps<T = 'continue', S = never> {
	path: string;
	site: string;
	username: string;
	stop$?: Observable<S> | S[];
	continue$?: Observable<T> | T[];
	localItem: ContentItem;
}

/**
 * Locks the target item, checks workflow state and checks for background changes
 * to the target. If all goes well, continues (returning the `continue$` stream). If
 * can't continue with the target operation, it returns the `stop$` stream (EMPTY, by default).
 */
export function beforeWrite$<T extends any = 'continue', S extends any = never>(
	props: BeforeWriteProps<T, S>
): Observable<T | S> {
	const { site, username, path, continue$ = of('continue') as Observable<T>, stop$ = EMPTY, localItem } = props;
	return lock(site, path).pipe(
		switchMap(() => forkJoin([fetchContentItem(site, path), fetchAffectedPackages(site, path)])),
		switchMap(([item, affectedPackages]) => {
			if (item.stateMap.submitted || item.stateMap.scheduled) {
				post(requestWorkflowCancellationDialog({ item, siteId: site }));
				return message$.pipe(
					filter((e) => e.type === requestWorkflowCancellationDialogOnResult.type),
					take(1),
					tap(({ payload }) => payload.type !== 'continue' && post(unlockItem({ path }))),
					switchMap(({ payload }) =>
						payload.type === 'continue'
							? cancelPackages(site, {
									packageIds: affectedPackages.map((p) => p.id),
									comment: payload.cancelPackagesComment || `Cancel packages to write on "${path}"`
								}).pipe(switchMap(() => continue$))
							: stop$
					)
				);
			} else if (item.dateModified !== localItem.dateModified && item.lockOwner?.username !== username) {
				post(snackGuestMessage({ id: 'outOfSyncContent', level: 'suggestion' }));
				post(unlockItem({ path }));
				setTimeout(() => window.location.reload());
				return stop$;
			} else {
				return continue$;
			}
		}),
		catchError(({ response, status }) => {
			if (status === 409) {
				post(snackGuestMessage({ id: 'itemLocked', level: 'suggestion', values: { lockOwner: response.person } }));
			}
			return stop$;
		})
	);
}

/**
 * Locks each distinct path in order and stops on the first failure. Paths locked earlier
 * in this call are unlocked. An empty list does not lock and does not continue.
 */
export function lockPaths$(
	paths: Array<string | null | undefined>,
	state: Pick<GuestState, 'activeSite' | 'username'>
): Observable<'continue'> {
	const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
	if (unique.length === 0) {
		return EMPTY;
	}
	const locked: string[] = [];
	return from(unique).pipe(
		concatMap((path) =>
			beforeWrite$({
				path,
				site: state.activeSite,
				username: state.username,
				localItem: getCachedContentItem(path)
			}).pipe(
				map(() => path),
				defaultIfEmpty(null)
			)
		),
		// A null path means that lock failed. takeWhile unsubscribes before the next path starts.
		takeWhile((path): path is string => {
			if (path) {
				locked.push(path);
				return true;
			}
			locked.forEach((held) => post(unlockItem({ path: held })));
			return false;
		}),
		filter((path) => locked.length === unique.length && path === unique[unique.length - 1]),
		map(() => 'continue' as const)
	);
}

/**
 * Checks if the target item is locked and checks for background changes. Returns all the objects
 * it uses to compute the result, so they can be used by consumer if needed.
 */
export const checkIfLockedOrModified = (state: GuestState, record: ElementRecord) => {
	let { modelId, fieldId } = record;
	// If the present record refers to a node selector item, we need to switch the model to that item of the collection.
	// Otherwise, is just the model from the present record.
	let model = getCachedModel(modelId);
	if (fieldId.length > 0) {
		const entries = getReferentialEntries(record.iceIds[0]);
		if (entries.recordType === 'node-selector-item') {
			// There can be a scenario where the node-selector item is a file. When it is, there is no model associated to
			// that item, so we fall back to the current model.
			model = getCachedModel(extractCollectionItem(model, fieldId[0], record.index)) ?? model;
			modelId = model.craftercms.id;
		}
	}
	const parentModelId = model?.craftercms.path ? null : getParentModelId(modelId, getCachedModels(), modelHierarchyMap);
	const parentModel = parentModelId ? getCachedModel(parentModelId) : null;
	const path = model?.craftercms.path ?? parentModel?.craftercms.path;
	const isLocked = Boolean(state.lockedPaths[path]);
	const isLockedByCurrentUser = isLocked && state.lockedPaths[path].user?.username === state.username;
	const isExternallyModified = Boolean(state.externallyModifiedPaths[path]);
	return { isLocked, isExternallyModified, model, parentModelId, parentModel, path, isLockedByCurrentUser };
};

/**
 * From a dragContext of a component being moved, returns an object with the following properties:
 * movedToSameZone: boolean
 * movedToSamePosition: boolean
 * draggedElementIndex: number
 * targetIndex: number
 */
export const getMoveComponentInfo = (dragContext: GuestState['dragContext']) => {
	let { dragged: draggedRecord, targetIndex, dropZone, dropZones } = dragContext;
	let newTargetIndex = targetIndex;
	let draggedElementIndex = (draggedRecord as ICERecord)?.index;
	const originDropZone = dropZones.find((dropZone) => dropZone.origin);
	const currentDZ = dropZone.element;
	const movedToSameZone = currentDZ === originDropZone?.element;
	let movedToSamePosition = false;

	if (typeof draggedElementIndex === 'string') {
		// If the index is a string, it's a nested index with dot notation.
		// At this point, we only care for the last index piece, which is
		// the index of this item in the collection that's being manipulated.
		draggedElementIndex = parseInt(draggedElementIndex.substring(draggedElementIndex.lastIndexOf('.') + 1));
	}

	// If same dropzone
	if (movedToSameZone) {
		// If moving the item down the array of items, need to account
		// for all the originally subsequent items shifting up.
		if (draggedElementIndex < targetIndex) {
			// Hence the final target index in reality is
			// the drop marker's index minus 1
			newTargetIndex = targetIndex - 1;
		}
		movedToSamePosition = draggedElementIndex === targetIndex;
	}

	// Not same dropzone => different position

	return {
		movedToSameZone,
		movedToSamePosition,
		draggedElementIndex,
		targetIndex: newTargetIndex
	};
};
