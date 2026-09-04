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
import { FormattedMessage } from 'react-intl';

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

	const trashButtonRef = React.useRef(undefined);
	const [showTrashConfirmation, setShowTrashConfirmation] = useState<boolean>(false);

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

	const store = useStore();
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

	const execOperation = (subscriber: () => void) => {
		const { username, activeSite } = store.getState();
		const { path } = getItemData();
		beforeWrite$({
			path,
			site: activeSite,
			username,
			localItem: getCachedContentItem(path)
		}).subscribe(subscriber);
	};

	const onCancel = () => {
		clearAndListen$.next();
		dispatch(startListening());
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
		onCancel();
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
		execOperation(() => {
			if (recordType === 'component' && nodeSelectorItemRecord) {
				sortUpItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
			} else {
				sortUpItem(modelId, fieldId, index);
			}
		});
		onCancel();
	};

	const onMoveDown = (e) => {
		e.preventDefault();
		e.stopPropagation();
		execOperation(() => {
			if (recordType === 'component' && nodeSelectorItemRecord) {
				sortDownItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
			} else {
				sortDownItem(modelId, fieldId, index);
			}
		});
		onCancel();
	};

	const doTrash = () => {
		setShowTrashConfirmation(false);
		const minCount = runValidation(findContainerRecord(modelId, fieldId, index).id, 'minCount', [
			numOfItemsInContainerCollection - 1
		]);
		if (minCount) {
			post(snackGuestMessage(minCount));
		} else {
			execOperation(() => {
				if (recordType === 'component' && nodeSelectorItemRecord) {
					deleteItem(nodeSelectorItemRecord.modelId, nodeSelectorItemRecord.fieldId, nodeSelectorItemRecord.index);
				} else {
					deleteItem(modelId, fieldId, index);
				}
			});
			onCancel();
		}
	};

	const onTrash = (e) => {
		e.preventDefault();
		e.stopPropagation();
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
		const top = e.clientY;
		const left = e.clientX;
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

	const refs = useRef({ onMoveUp, onMoveDown, onTrash, doTrash, onCancel, isFirstItem, isLastItem });

	// Listen for key input to sort/delete and for clicking outside the zone to dismiss selection.
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'ArrowLeft':
				case 'ArrowUp': {
					if (isMovable && !refs.current.isFirstItem) {
						refs.current.onMoveUp(e);
					}
					break;
				}
				case 'ArrowRight':
				case 'ArrowDown': {
					if (isMovable && !refs.current.isLastItem) {
						refs.current.onMoveDown(e);
					}
					break;
				}
				case 'Backspace': {
					if (isTrashable) {
						e.preventDefault();
						setShowTrashConfirmation(true);
					}
					break;
				}
			}
		};
		const onClickOut = (e: MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			refs.current.onCancel();
		};
		document.addEventListener('keydown', onKeyDown, false);
		document.addEventListener('click', onClickOut, false);
		return () => {
			document.removeEventListener('keydown', onKeyDown, false);
			document.removeEventListener('click', onClickOut, false);
		};
	}, []);

	return (
		<>
			<Box display="flex">
				{hasEditAction && !isLockedItem && (
					<UltraStyledTooltip title={<FormattedMessage id="words.edit" defaultMessage="Edit" />} key="edit">
						<UltraStyledIconButton size="small" onClick={onEdit}>
							<PencilIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{isLockedByCurrentUser && (
					<UltraStyledTooltip title="Unlock" key="unlock">
						<UltraStyledIconButton size="small" onClick={onUnlock}>
							<UnlockIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{showCodeEditOptions && (
					<>
						{itemAvailableActions.editTemplate && (
							<UltraStyledTooltip
								title={<FormattedMessage id="zoneMenu.editTemplate" defaultMessage="Edit template" />}
								key="editTemplate"
							>
								<UltraStyledIconButton size="small" onClick={onEditTemplate}>
									<FreemarkerIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						)}
						{itemAvailableActions.editController && (
							<UltraStyledTooltip
								title={<FormattedMessage id="zoneMenu.editController" defaultMessage="Edit controller" />}
								key="editController"
							>
								<UltraStyledIconButton size="small" onClick={onEditController}>
									<GroovyIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						)}
					</>
				)}
				{!isLockedItem && showAddItem && (
					<UltraStyledTooltip
						title={<FormattedMessage id="zoneMenu.addItem" defaultMessage="Add new item" />}
						key="addNewItem"
					>
						<UltraStyledIconButton size="small" onClick={onAddRepeatItem}>
							<AddCircleOutlineRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{showDuplicate && (
					<UltraStyledTooltip
						title={<FormattedMessage id="zoneMenu.duplicateItem" defaultMessage="Duplicate item" />}
						key="duplicateItem"
					>
						<UltraStyledIconButton size="small" onClick={onDuplicateItem}>
							<ContentCopyRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{isMovable &&
					(!isLockedItem || !isEmbedded) &&
					!isOnlyItem && [
						!isFirstItem && (
							<UltraStyledTooltip
								title={<FormattedMessage id="zoneMenu.moveUp" defaultMessage="Move up/left (← or ↑)" />}
								key="moveUp"
							>
								<UltraStyledIconButton size="small" onClick={onMoveUp}>
									<ArrowUpwardRoundedIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						),
						!isLastItem && (
							<UltraStyledTooltip
								title={<FormattedMessage id="zoneMenu.moveDown" defaultMessage="Move down/right (→ or ↓)" />}
								key="moveDown"
							>
								<UltraStyledIconButton size="small" onClick={onMoveDown}>
									<ArrowDownwardRoundedIcon />
								</UltraStyledIconButton>
							</UltraStyledTooltip>
						)
					]}
				{isTrashable && !isLockedItem && (
					<UltraStyledTooltip title={<FormattedMessage id="zoneMenu.trash" defaultMessage="Trash (⌫)" />} key="trash">
						<UltraStyledIconButton size="small" onClick={onTrash} ref={trashButtonRef}>
							<DeleteOutlineRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				{isMovable && (!isLockedItem || !isEmbedded) && (
					<UltraStyledTooltip title={<FormattedMessage id="words.move" defaultMessage="Move" />} key="move">
						<UltraStyledIconButton size="small" draggable sx={{ cursor: 'grab' }} onDragStart={onDragStart}>
							<DragIndicatorRounded />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
			</Box>
			<Box display="flex">
				<Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
				{showItemMenuButton && (
					<UltraStyledTooltip
						title={<FormattedMessage id="words.options" defaultMessage="Options" />}
						onClick={handleRequestItemMenu}
					>
						<UltraStyledIconButton size="small">
							<MoreRoundedIcon />
						</UltraStyledIconButton>
					</UltraStyledTooltip>
				)}
				<UltraStyledTooltip title={<FormattedMessage id="zoneMenu.cancel" defaultMessage="Cancel (Esc)" />}>
					<UltraStyledIconButton size="small" onClick={onCancel}>
						<CloseRoundedIcon />
					</UltraStyledIconButton>
				</UltraStyledTooltip>
			</Box>
			<Menu
				anchorEl={trashButtonRef.current}
				open={showTrashConfirmation}
				onClose={() => setShowTrashConfirmation(false)}
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
		</>
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
