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

import * as React from 'react';
import { Dispatch, useEffect, useMemo, useState } from 'react';
import DragIndicatorRounded from '@mui/icons-material/DragIndicatorRounded';
import PencilIcon from '@mui/icons-material/EditOutlined';
import UnlockIcon from '@craftercms/studio-ui/icons/Unlock';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import GroovyIcon from '@craftercms/studio-ui/icons/Groovy';
import FreemarkerIcon from '@craftercms/studio-ui/icons/Freemarker';
import UltraStyledIconButton from './UltraStyledIconButton';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MoreRoundedIcon from '@mui/icons-material/MoreVertRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import {
	deleteItem,
	duplicateItem,
	getCachedContentItem,
	getCachedContentTypes,
	getCachedModel,
	getCachedModels,
	getCachedPermissions,
	getModelIdFromInheritedField,
	insertItem,
	isInheritedField,
	modelHierarchyMap,
	sortDownItem,
	sortUpItem
} from '../contentController';
import { clearAndListen$ } from '../store/subjects';
import { startListening } from '../store/actions';
import { ElementRecord } from '../models/InContextEditing';
import { extractCollection, findParentModelId } from '@craftercms/studio-ui/utils/model';
import { isSimple, popPiece } from '@craftercms/studio-ui/utils/string';
import { AnyAction } from '@reduxjs/toolkit';
import useRef from '@craftercms/studio-ui/hooks/useUpdateRefs';
import { exists, findContainerRecord, getById, getReferentialEntries, runValidation } from '../iceRegistry';
import { post } from '../utils/communicator';
import { requestEdit, snackGuestMessage } from '@craftercms/studio-ui/state/actions/preview';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { getParentModelId, resolvePlacementForZone } from '../utils/ice';
import { fromICEId, get } from '../elementRegistry';
import { beforeWrite$ } from '../store/util';
import { useStore } from './GuestContext';
import UltraStyledTypography from './UltraStyledTypography';
import UltraStyledTooltip from './UltraStyledTooltip';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { unlockItem } from '@craftercms/studio-ui/state/actions/content';
import { showItemMegaMenu } from '@craftercms/studio-ui/state/actions/dialogs';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { announceGuestStatus } from '../utils/guestAnnounce';
import {
	clearZoneOpenedFromKeyboard,
	focusAddressesAfterRemoval,
	requestZoneFocus,
	shiftedCollectionIndex,
	wasZoneOpenedFromKeyboard
} from '../utils/zoneFocus';

const zoneActionLabels = defineMessages({
	edit: { id: 'words.edit', defaultMessage: 'Edit' },
	unlock: { id: 'zoneMenu.unlock', defaultMessage: 'Unlock' },
	editTemplate: { id: 'zoneMenu.editTemplate', defaultMessage: 'Edit template' },
	editController: { id: 'zoneMenu.editController', defaultMessage: 'Edit controller' },
	addItem: { id: 'zoneMenu.addItem', defaultMessage: 'Add new item' },
	duplicateItem: { id: 'zoneMenu.duplicateItem', defaultMessage: 'Duplicate item' },
	moveUpName: { id: 'zoneMenu.moveUpName', defaultMessage: 'Move up' },
	moveDownName: { id: 'zoneMenu.moveDownName', defaultMessage: 'Move down' },
	trashName: { id: 'zoneMenu.trashName', defaultMessage: 'Trash' },
	options: { id: 'words.options', defaultMessage: 'Options' },
	cancelName: { id: 'zoneMenu.cancelName', defaultMessage: 'Cancel' },
	drag: { id: 'zoneMenu.drag', defaultMessage: 'Drag {label}' }
});

const zoneMenuMessages = defineMessages({
	actionForZone: { id: 'zoneMenu.actionForZone', defaultMessage: '{action}, {zone}' },
	moved: { id: 'ice.moved', defaultMessage: 'Moved {label}.' },
	untitledZone: { id: 'ice.untitledZone', defaultMessage: 'Content zone' }
});

type ZoneAction = keyof Omit<typeof zoneActionLabels, 'drag'>;

export interface ZoneMenuProps {
	record: ElementRecord;
	dispatch: Dispatch<AnyAction>;
	isHeadlessMode: boolean;
	isLockedItem?: boolean;
	isLockedByCurrentUser?: boolean;
}

export function ZoneMenu(props: ZoneMenuProps) {
	const { record, dispatch, isHeadlessMode, isLockedItem = false, isLockedByCurrentUser = false } = props;
	const {
		modelId,
		fieldId: [fieldId],
		index
	} = record;

	const permissions = getCachedPermissions();
	const models = getCachedModels();
	const parentModelId = getParentModelId(modelId, models, modelHierarchyMap);
	const modelPath = isInheritedField(modelId, fieldId)
		? models[getModelIdFromInheritedField(modelId, fieldId)].craftercms.path
		: (models[modelId].craftercms.path ?? models[parentModelId].craftercms.path);

	const menuRef = React.useRef<HTMLDivElement>(null);
	const [trashAnchor, setTrashAnchor] = useState<HTMLElement | null>(null);
	const [showTrashConfirmation, setShowTrashConfirmation] = useState<boolean>(false);
	const { formatMessage } = useIntl();

	const iceRecord = getById(record.iceIds[0]);
	const recordType = iceRecord.recordType;

	// Shared components can live in multiple fields; resolve this zone's placement via DOM context
	// instead of modelHierarchyMap's single parent pointer.
	const placement = useMemo(
		() =>
			recordType === 'component'
				? resolvePlacementForZone(
						modelId,
						record.element,
						getCachedModels(),
						getCachedContentTypes(),
						modelHierarchyMap
					)
				: null,
		[modelId, record.element, recordType]
	);

	const collection = useMemo(() => {
		if (['node-selector-item', 'repeat-item'].includes(recordType)) {
			return extractCollection(getCachedModel(modelId), fieldId, index);
		} else if (recordType === 'component') {
			if (placement?.parentId) {
				return extractCollection(
					getCachedModel(placement.parentId),
					placement.parentContainerFieldPath,
					placement.parentContainerFieldIndex
				);
			} else {
				return null;
			}
		} else {
			return null;
		}
	}, [modelId, fieldId, index, recordType, placement]);
	const elementIndex = useMemo(() => {
		if (recordType === 'component') {
			if (placement) {
				const placementIndex = placement.parentContainerFieldIndex;
				return parseInt(isSimple(placementIndex) ? String(placementIndex) : popPiece(String(placementIndex)));
			}
			return collection?.indexOf(modelId);
		}
		return parseInt(isSimple(index) ? String(index) : popPiece(String(index)));
	}, [recordType, collection, modelId, index, placement]);
	const nodeSelectorItemRecord = useMemo(
		// region
		() =>
			recordType === 'component'
				? placement
					? getById(
							exists({
								modelId: placement.parentId,
								fieldId: placement.parentContainerFieldPath,
								index: placement.parentContainerFieldIndex
							})
						)
					: null
				: ['node-selector-item', 'repeat-item'].includes(recordType)
					? iceRecord
					: null,
		// endregion
		[placement, recordType, iceRecord]
	);
	// TODO: Revisit how we detect files. Checking it has a key property doesn't feel robust.
	// File validations only applies to node-selector, not to repeating-group
	const isItemFile =
		collection && recordType === 'node-selector-item'
			? Boolean(collection[elementIndex]?.hasOwnProperty('key'))
			: false;
	const collectionContainsFiles =
		collection && recordType === 'node-selector-item' ? collection.some((item) => item.hasOwnProperty('key')) : false;
	const componentId =
		recordType === 'component' ? modelId : recordType === 'node-selector-item' ? collection?.[elementIndex] : null;
	const componentPath = models[componentId]?.craftercms.path;
	const { field, contentType } = useMemo(() => getReferentialEntries(record.iceIds[0]), [record.iceIds]);

	// Content-root of the container that owns this zone. For components, prefer placement.parentId so shared
	// components (multiple parents; hierarchy map keeps one) use this zone's parent, not another placement's.
	let containerModelId;
	if (recordType === 'component' && placement?.parentId) {
		const immediateParentId = placement.parentId;
		containerModelId = models[immediateParentId]?.craftercms.path
			? immediateParentId
			: (findParentModelId(immediateParentId, modelHierarchyMap, models) ?? immediateParentId);
	} else {
		containerModelId = findParentModelId(componentId ?? modelId, modelHierarchyMap, models) ?? modelId;
	}
	const containerItemAvailableActions = models[containerModelId]
		? getCachedContentItem(models[containerModelId].craftercms.path).availableActionsMap
		: null;
	const containerHasEditAction = containerItemAvailableActions?.edit ?? false;
	const itemAvailableActions = getCachedContentItem(componentPath ?? modelPath).availableActionsMap;
	const hasEditAction = itemAvailableActions.edit;

	const isMovable =
		containerHasEditAction &&
		(['node-selector-item', 'repeat-item'].includes(recordType) ||
			Boolean(recordType === 'component' && nodeSelectorItemRecord));
	const numOfItemsInContainerCollection = collection?.length;
	const isFirstItem = isMovable ? elementIndex === 0 : null;
	const isLastItem = isMovable ? elementIndex === numOfItemsInContainerCollection - 1 : null;
	const isOnlyItem = isMovable ? isFirstItem && isLastItem : null;
	const isEmbedded = useMemo(() => !Boolean(getCachedModel(modelId)?.craftercms.path), [modelId]);
	const showCodeEditOptions =
		hasEditAction && !isHeadlessMode && !isItemFile && ['component', 'page', 'node-selector-item'].includes(recordType);
	const showAddItem = hasEditAction && recordType === 'field' && field.type === 'repeat';
	const { isTrashable, showDuplicate } = useMemo(() => {
		const actions = {
			isTrashable: false,
			showDuplicate: false
		};

		const nodeSelectorEntries = Boolean(nodeSelectorItemRecord) ? getReferentialEntries(nodeSelectorItemRecord) : null;

		if (containerHasEditAction && Boolean(collection)) {
			const validations = nodeSelectorEntries?.field?.validations;
			const maxValidation = validations?.maxCount?.value;
			const minValidation = validations?.minCount?.value;
			const trashableValidation = minValidation ? minValidation < numOfItemsInContainerCollection : true;
			const duplicateValidation =
				permissions.includes('content_create') &&
				(maxValidation ? maxValidation > numOfItemsInContainerCollection : true);

			// The trash/duplicate are not applicable outside of item selector or repeat group type fields:
			if (
				// Record is an item, then options apply.
				['node-selector-item', 'repeat-item'].includes(recordType) ||
				// A component has been directly selected (as opposed to an item selector item that was translated to a component):
				// must determine if it is part of an item selector and not a standalone model being rendered on to the page.
				Boolean(recordType === 'component' && nodeSelectorItemRecord)
			) {
				actions.isTrashable = trashableValidation && recordType !== 'field' && recordType !== 'page';
				actions.showDuplicate =
					duplicateValidation && !isItemFile && ['repeat-item', 'component', 'node-selector-item'].includes(recordType);
			}
		}

		return actions;
	}, [
		nodeSelectorItemRecord,
		collection,
		numOfItemsInContainerCollection,
		permissions,
		containerHasEditAction,
		recordType,
		isItemFile
	]);
	const showItemMenuButton = ['node-selector-item', 'component', 'page'].includes(recordType);
	const zoneLabel = record.label || field?.name || contentType?.name || '';

	const store = useStore();
	const named = (action: ZoneAction): string => {
		const actionText = formatMessage(zoneActionLabels[action]) as string;
		if (!zoneLabel) {
			return actionText;
		}
		return formatMessage(zoneMenuMessages.actionForZone, { action: actionText, zone: zoneLabel }) as string;
	};
	const moveSource = () =>
		nodeSelectorItemRecord
			? {
					modelId: nodeSelectorItemRecord.modelId,
					fieldId: String(nodeSelectorItemRecord.fieldId),
					index: nodeSelectorItemRecord.index
				}
			: { modelId, fieldId: record.fieldId.join('.'), index };
	const getItemData = () => {
		const models = getCachedModels();
		const isNodeSelectorItem = recordType === 'component' && Boolean(nodeSelectorItemRecord);
		const itemModelId = isNodeSelectorItem ? nodeSelectorItemRecord.modelId : modelId;
		const itemFieldId = isNodeSelectorItem ? nodeSelectorItemRecord.fieldId : fieldId;
		const itemIndex = isNodeSelectorItem ? nodeSelectorItemRecord.index : index;
		const path = models[itemModelId]?.craftercms.path ?? modelPath;
		return { path, itemModelId, itemFieldId, itemIndex };
	};

	// region Callbacks

	const execOperation = (subscriber: () => void, onSkipped?: () => void) => {
		const { username, activeSite } = store.getState();
		const { path } = getItemData();
		let ran = false;
		beforeWrite$({
			path,
			site: activeSite,
			username,
			localItem: getCachedContentItem(path)
		}).subscribe({
			next: () => {
				ran = true;
				subscriber();
			},
			complete: () => !ran && onSkipped?.()
		});
	};

	const closeMenu = () => {
		clearAndListen$.next();
		dispatch(startListening());
	};

	const onCancel = () => {
		closeMenu();
		requestZoneFocus({ iceId: record.iceIds[0] });
	};

	const focusAfterMove = (delta: number) => {
		const source = moveSource();
		requestZoneFocus({
			iceId: record.iceIds[0],
			address: {
				modelId: source.modelId,
				fieldId: source.fieldId,
				index: shiftedCollectionIndex(source.index, delta)
			},
			afterRegistryChange: true
		});
	};

	const announceMove = () => {
		announceGuestStatus(
			formatMessage(zoneMenuMessages.moved, {
				label: zoneLabel || (formatMessage(zoneMenuMessages.untitledZone) as string)
			}) as string
		);
	};

	const commonEdit = (e, typeOfEdit) => {
		e.stopPropagation();
		e.preventDefault();

		if (recordType === 'node-selector-item' && !collectionContainsFiles) {
			// If it's a node selector item, we transform it into the actual item.
			const parentModelId = getParentModelId(componentId, getCachedModels(), modelHierarchyMap);
			post(requestEdit({ typeOfEdit, modelId: componentId, parentModelId }));
		} else {
			let modelIdToEdit = modelId;
			// If inherited field - set correct modelId to edit
			if (record.inherited) {
				modelIdToEdit = getModelIdFromInheritedField(modelId, fieldId);
			}
			// For components, resolve edit parent from this zone's placement (not hierarchy map's single parent).
			let parentModelId: string | null;
			if (recordType === 'component' && placement?.parentId) {
				const cachedModels = getCachedModels();
				parentModelId = cachedModels[modelIdToEdit]?.craftercms.path
					? null
					: cachedModels[placement.parentId]?.craftercms.path
						? placement.parentId
						: findParentModelId(placement.parentId, modelHierarchyMap, cachedModels);
			} else {
				parentModelId = getParentModelId(modelIdToEdit, getCachedModels(), modelHierarchyMap);
			}
			post(
				requestEdit({
					typeOfEdit,
					modelId: modelIdToEdit,
					parentModelId,
					fields: record.fieldId,
					index
				})
			);
		}
		// The host opens the edit dialog. Restoring guest focus here would steal it (2.4.3).
		closeMenu();
	};

	const onEdit = (e) => {
		// When the item is locked, text fields get the selection & ZoneMenu (as opposed to direct
		// activation of the RTE) so the user can unlock. After unlocking, the edit action will show
		// up and this logic routes that logic to edit inline instead of opening the form.
		const { field } = getReferentialEntries(record.iceIds[0]);
		if (field != null && ['html', 'text', 'textarea'].includes(field.type)) {
			e.stopPropagation();
			store.dispatch({ type: 'triggered_click', payload: { record, event: e } });
		} else {
			commonEdit(e, 'content');
		}
	};

	const onEditController = (e) => {
		commonEdit(e, 'controller');
	};

	const onEditTemplate = (e) => {
		commonEdit(e, 'template');
	};

	const onAddRepeatItem = (e) => {
		execOperation(() => {
			insertItem(modelId, fieldId, index, contentType);
		});
	};

	const onDuplicateItem = (e) => {
		execOperation(() => {
			if (recordType === 'component' && nodeSelectorItemRecord) {
				duplicateItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
			} else {
				duplicateItem(modelId, fieldId, index);
			}
		});
		onCancel();
	};

	const onMoveUp = (e) => {
		e.preventDefault();
		e.stopPropagation();
		// Keep a zone button focused while the menu unmounts. The new index is focused only after the move.
		requestZoneFocus({ iceId: record.iceIds[0] });
		execOperation(() => {
			if (recordType === 'component' && nodeSelectorItemRecord) {
				sortUpItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
			} else {
				sortUpItem(modelId, fieldId, index);
			}
			announceMove();
			focusAfterMove(-1);
		});
		closeMenu();
	};

	const onMoveDown = (e) => {
		e.preventDefault();
		e.stopPropagation();
		requestZoneFocus({ iceId: record.iceIds[0] });
		execOperation(() => {
			if (recordType === 'component' && nodeSelectorItemRecord) {
				sortDownItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
			} else {
				sortDownItem(modelId, fieldId, index);
			}
			announceMove();
			focusAfterMove(1);
		});
		closeMenu();
	};

	const doTrash = () => {
		setShowTrashConfirmation(false);
		const minCount = runValidation(findContainerRecord(modelId, fieldId, index).id, 'minCount', [
			numOfItemsInContainerCollection - 1
		]);
		if (minCount) {
			post(snackGuestMessage(minCount));
			return;
		}
		const source = moveSource();
		const originIceId = record.iceIds[0];
		// If the lock fails, the item is still here. After a successful delete, focus the same index,
		// otherwise the previous item, otherwise the next.
		requestZoneFocus({ iceId: originIceId });
		execOperation(
			() => {
				if (recordType === 'component' && nodeSelectorItemRecord) {
					deleteItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
				} else {
					deleteItem(modelId, fieldId, index);
				}
				requestZoneFocus({
					iceId: originIceId,
					addresses: focusAddressesAfterRemoval(source.modelId, source.fieldId, source.index),
					afterRegistryChange: true,
					focusCurrent: false
				});
			},
			// Lock refused or cancelled: the item is still here. Ask for focus again once the menu has closed.
			() => requestAnimationFrame(() => requestZoneFocus({ iceId: originIceId }))
		);
		closeMenu();
	};

	const onTrash = (e) => {
		e.preventDefault();
		e.stopPropagation();
		setTrashAnchor(e.currentTarget);
		setShowTrashConfirmation(true);
	};

	const onDragStart = (e) => {
		let _record = record;
		if (recordType === 'component' && nodeSelectorItemRecord) {
			_record = get(fromICEId(nodeSelectorItemRecord.id).id);
		}
		e.stopPropagation();
		e.dataTransfer.setData('text/plain', `${_record.id}`);
		e.dataTransfer.setDragImage(document.querySelector('.craftercms-dragged-element'), 20, 20);
		setTimeout(() => {
			dispatch({ type: 'dragstart', payload: { event: null, record: _record } });
		});
	};

	const handleRequestItemMenu = (e) => {
		e.stopPropagation();
		const path =
			recordType === 'component' || recordType === 'node-selector-item' ? (componentPath ?? modelPath) : modelPath;
		let top = e.clientY;
		let left = e.clientX;
		// Enter/Space reports detail 0 and client coordinates at the origin.
		if (e.detail === 0) {
			const rect = e.currentTarget.getBoundingClientRect();
			top = rect.bottom;
			left = rect.left;
		}
		post(
			showItemMegaMenu({
				path,
				anchorReference: 'anchorPosition',
				anchorPosition: { top, left }
			})
		);
	};

	const onUnlock = (e) => {
		e.stopPropagation();
		const path =
			recordType === 'component' || recordType === 'node-selector-item' ? (componentPath ?? modelPath) : modelPath;
		post(unlockItem({ path }));
	};

	// endregion

	const closeSubmenus = () => {
		setShowTrashConfirmation(false);
	};

	// MUI types the menu onClose event as {}. The backdrop click is a real mouse event.
	const stopSubmenuDismiss = (event: object) => {
		const dismissEvent = event as { stopPropagation?: () => void; nativeEvent?: { stopPropagation?: () => void } };
		dismissEvent.stopPropagation?.();
		dismissEvent.nativeEvent?.stopPropagation?.();
	};

	const refs = useRef({
		onMoveUp,
		onMoveDown,
		onTrash,
		doTrash,
		onCancel,
		isFirstItem,
		isLastItem,
		isMovable,
		isTrashable,
		showTrashConfirmation,
		closeSubmenus,
		iceId: record.iceIds[0]
	});

	// Listen for key input to sort/delete and for clicking outside the zone to dismiss selection.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			const keyTarget = e.target instanceof Element ? e.target : null;
			const inZoneChrome = Boolean(keyTarget?.closest('[data-craftercms-zone-menu],[data-craftercms-ice-control]'));
			const inOurSubmenu = Boolean(keyTarget?.closest('[data-craftercms-zone-submenu]'));
			// A click can leave focus on the document while this menu is still open.
			const looseFocus = e.target === document.body || e.target === document.documentElement || e.target === document;
			const submenuOpen = refs.current.showTrashConfirmation;
			// Escape inside the confirm menu closes only that menu. Other widgets keep their keys.
			if (e.key === 'Escape' && submenuOpen && (inOurSubmenu || inZoneChrome)) {
				e.preventDefault();
				e.stopPropagation();
				refs.current.closeSubmenus();
				return;
			}
			if (!inZoneChrome && !looseFocus) {
				return;
			}
			if (e.key === 'Escape') {
				requestZoneFocus({ iceId: refs.current.iceId });
				return;
			}
			if (e.defaultPrevented || submenuOpen || keyTarget?.closest('input,textarea,select,[contenteditable]')) {
				return;
			}
			switch (e.key) {
				case 'ArrowLeft':
				case 'ArrowUp': {
					if (refs.current.isMovable && !refs.current.isFirstItem) {
						refs.current.onMoveUp(e);
					}
					break;
				}
				case 'ArrowRight':
				case 'ArrowDown': {
					if (refs.current.isMovable && !refs.current.isLastItem) {
						refs.current.onMoveDown(e);
					}
					break;
				}
				case 'Backspace': {
					if (refs.current.isTrashable) {
						e.preventDefault();
						const trashButton = menuRef.current?.querySelector<HTMLElement>('[aria-keyshortcuts="Backspace"]');
						if (trashButton) {
							setTrashAnchor(trashButton);
						}
						setShowTrashConfirmation(true);
					}
					break;
				}
			}
		};
		const onClickOut = (e: MouseEvent) => {
			const target = e.target as Element | null;
			// Zone keyboard buttons dispatch their own click. The zone menu and an open submenu
			// must not be treated as an outside click.
			if (target?.closest?.('[data-craftercms-ice-control],[data-craftercms-zone-menu],[role="menu"]')) {
				return;
			}
			e.stopPropagation();
			e.preventDefault();
			if (refs.current.showTrashConfirmation) {
				refs.current.closeSubmenus();
				return;
			}
			refs.current.onCancel();
		};
		document.addEventListener('keydown', onKeyDown, true);
		document.addEventListener('click', onClickOut, false);
		if (wasZoneOpenedFromKeyboard()) {
			menuRef.current?.querySelector<HTMLButtonElement>('button:not([tabindex="-1"])')?.focus({ preventScroll: true });
		}
		return () => {
			clearZoneOpenedFromKeyboard();
			document.removeEventListener('keydown', onKeyDown, true);
			document.removeEventListener('click', onClickOut, false);
		};
	}, []);

	const dragLabel = formatMessage(zoneActionLabels.drag, {
		label: zoneLabel || (formatMessage(zoneMenuMessages.untitledZone) as string)
	}) as string;

	return (
		<Box ref={menuRef} data-craftercms-zone-menu="" sx={{ display: 'contents' }}>
			<Box sx={{ display: 'flex' }}>
				{hasEditAction && !isLockedItem && (
					<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.edit)} key="edit">
						<UltraStyledIconButton size="small" aria-label={named('edit')} onClick={onEdit}>
							<PencilIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{isLockedByCurrentUser && (
					<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.unlock)} key="unlock">
						<UltraStyledIconButton size="small" aria-label={named('unlock')} onClick={onUnlock}>
							<UnlockIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{showCodeEditOptions && (
					<>
						{itemAvailableActions.editTemplate && (
							<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.editTemplate)} key="editTemplate">
								<UltraStyledIconButton size="small" aria-label={named('editTemplate')} onClick={onEditTemplate}>
									<FreemarkerIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						)}
						{itemAvailableActions.editController && (
							<UltraStyledTooltip
								describeChild
								title={formatMessage(zoneActionLabels.editController)}
								key="editController"
							>
								<UltraStyledIconButton size="small" aria-label={named('editController')} onClick={onEditController}>
									<GroovyIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						)}
					</>
				)}
				{!isLockedItem && showAddItem && (
					<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.addItem)} key="addNewItem">
						<UltraStyledIconButton size="small" aria-label={named('addItem')} onClick={onAddRepeatItem}>
							<AddCircleOutlineRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{showDuplicate && (
					<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.duplicateItem)} key="duplicateItem">
						<UltraStyledIconButton size="small" aria-label={named('duplicateItem')} onClick={onDuplicateItem}>
							<ContentCopyRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{isMovable &&
					(!isLockedItem || !isEmbedded) &&
					!isOnlyItem && [
						!isFirstItem && (
							<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.moveUpName)} key="moveUp">
								<UltraStyledIconButton
									size="small"
									aria-label={named('moveUpName')}
									aria-keyshortcuts="ArrowUp ArrowLeft"
									onClick={onMoveUp}
								>
									<ArrowUpwardRoundedIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						),
						!isLastItem && (
							<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.moveDownName)} key="moveDown">
								<UltraStyledIconButton
									size="small"
									aria-label={named('moveDownName')}
									aria-keyshortcuts="ArrowDown ArrowRight"
									onClick={onMoveDown}
								>
									<ArrowDownwardRoundedIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						)
					]}
				{isTrashable && !isLockedItem && (
					<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.trashName)} key="trash">
						<UltraStyledIconButton
							size="small"
							aria-label={named('trashName')}
							aria-keyshortcuts="Backspace"
							onClick={onTrash}
						>
							<DeleteOutlineRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{isMovable && (!isLockedItem || !isEmbedded) && (
					<UltraStyledTooltip title={dragLabel} key="move">
						<UltraStyledIconButton
							size="small"
							draggable
							tabIndex={-1}
							aria-hidden
							sx={{ cursor: 'grab' }}
							onDragStart={onDragStart}
						>
							<DragIndicatorRounded />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
			</Box>
			<Box sx={{ display: 'flex' }}>
				<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
				{showItemMenuButton && (
					<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.options)}>
						<UltraStyledIconButton size="small" aria-label={named('options')} onClick={handleRequestItemMenu}>
							<MoreRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				<UltraStyledTooltip describeChild title={formatMessage(zoneActionLabels.cancelName)}>
					<UltraStyledIconButton
						size="small"
						aria-label={named('cancelName')}
						aria-keyshortcuts="Escape"
						onClick={onCancel}
					>
						<CloseRoundedIcon />
					</UltraStyledIconButton>
				</UltraStyledTooltip>
			</Box>
			<Menu
				anchorEl={trashAnchor}
				open={showTrashConfirmation}
				onClose={(event) => {
					stopSubmenuDismiss(event);
					setShowTrashConfirmation(false);
				}}
				slotProps={{
					list: { 'data-craftercms-zone-submenu': '' },
					backdrop: {
						onClick: (event) => {
							event.stopPropagation();
						}
					}
				}}
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'right'
				}}
				transformOrigin={{
					vertical: 'top',
					horizontal: 'right'
				}}
				sx={{ zIndex: 1501 }}
			>
				<UltraStyledTypography variant="body1" sx={{ padding: '10px 16px 10px 16px' }}>
					<FormattedMessage
						id="zoneMenu.trashConfirmation"
						defaultMessage="{isEmbedded, select, true {Delete} other {Disassociate}} this item?"
						values={{ isEmbedded }}
					/>
				</UltraStyledTypography>
				<MenuItem
					onClick={(e) => {
						e.preventDefault();
						setShowTrashConfirmation(false);
					}}
				>
					<UltraStyledTypography>
						<FormattedMessage id="words.no" defaultMessage="No" />
					</UltraStyledTypography>
				</MenuItem>
				<MenuItem onClick={(e) => refs.current.doTrash()}>
					<UltraStyledTypography>
						<FormattedMessage id="words.yes" defaultMessage="Yes" />{' '}
					</UltraStyledTypography>
				</MenuItem>
			</Menu>
		</Box>
	);
}

// Could use a more generic version...
// function IconButtonCollection({ actions }) {
//   return actions.map((action) => (
//     <Tooltip title={`${action.label} ${action.shortcut ?? ''}`.trim()}>
//       <UltraStyledIconButton size="small" {...action.props}>
//         <DragIndicatorRounded />
//       </UltraStyledIconButton>
//     </Tooltip>
//   ));
// }

export default ZoneMenu;
