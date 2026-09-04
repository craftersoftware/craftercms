/*
 * Copyright (C) 2007-2024 Crafter Software Corporation. All Rights Reserved.
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

import { useItemContext, useItemMetaContext, useStableGlobalApiContext } from '../lib/formsEngineContext';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HelpOutline from '@mui/icons-material/HelpOutline';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { FormsEngineField } from '../components/FormsEngineField';
import { ControlProps } from '../types';
import type { ContentItem, MediaItem, Primitive } from '../../../models';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import ListItemButton from '@mui/material/ListItemButton';
import { FormattedMessage } from 'react-intl';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import Tooltip from '@mui/material/Tooltip';
import useContentTypes from '../../../hooks/useContentTypes';
import React, {
	lazy,
	MouseEvent as ReactMouseEvent,
	ReactNode,
	RefObject,
	Suspense,
	SyntheticEvent,
	useEffect,
	useMemo,
	useState
} from 'react';
import Menu from '@mui/material/Menu';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';
import LookupTable from '../../../models/LookupTable';
import AllowedContentTypesData from '../../../models/AllowedContentTypesData';
import { asArray } from '../../../utils/array';
import ListItemIcon, { listItemIconClasses } from '@mui/material/ListItemIcon';
import TravelExploreOutlined from '@mui/icons-material/TravelExploreOutlined';
import { svgIconClasses } from '@mui/material/SvgIcon';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Grid from '@mui/material/Grid';
import ContentType from '../../../models/ContentType';
import { fetchAllowedTypes } from '../../../services/contentTypes';
import useActiveSiteId from '../../../hooks/useActiveSiteId';
import { forkJoin } from 'rxjs';
import Dialog from '@mui/material/Dialog';
import { DialogHeader } from '../../DialogHeader';
import { DialogFooter } from '../../DialogFooter';
import PrimaryButton from '../../PrimaryButton';
import SecondaryButton from '../../SecondaryButton';
import { DialogBody } from '../../DialogBody';
import Typography from '@mui/material/Typography';
import { useDispatch } from 'react-redux';
import { nanoid } from 'nanoid';
import useUpdateRefs from '../../../hooks/useUpdateRefs';
import useFetchContentItems from '../../../hooks/useFetchContentItems';
import useItemsByPath from '../../../hooks/useItemsByPath';
import ItemDisplay from '../../ItemDisplay';
import useActiveUser from '../../../hooks/useActiveUser';
import { getFileExtension, processPathMacros } from '../../../utils/path';
import { ensureSingleSlash, isEmpty } from '../../../utils/string';
import { popDialog, pushDialog } from '../../../state/actions/dialogStack';
import FieldBox from '../components/FieldBox';
import { isTouchDevice, KeyDownEvent, sortableListKeyDownHandler } from '../lib/sortableListUtil';
import SortableListSkeleton from '../components/SortableListSkeleton';
import { EmptyState } from '../../EmptyState';
import { XmlKeys } from '../lib/formConsts';
import { showBrowseFilesDialog, showSearchDialog } from '../lib/controlHelpers';
import { Dispatch as ReduxDispatch } from 'redux';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import type { FileUploadResult } from '../../SingleFileUpload';
import type { SingleFileUploadDialogProps } from '../../SingleFileUploadDialog';
import { showCodeEditorDialog } from '../../../state/actions/dialogs';
import { getEditorMode, isAudio, isEditableAsset, isPdfDocument, isVideo } from '../../../utils/content';
import { createComponentId, pickShowContentFormAction } from '../../../utils/system';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
	getEditorMode as getItemEditorMode,
	isEditableViaFormEditor,
	isImage,
	isMediaContent
} from '../../PathNavigator/utils';
import useSelection from '../../../hooks/useSelection';
import { getValidationValue, isFieldReadOnly, showAlert } from '../lib/formUtils';
import TypeList from '../../ContentTypeManagement/components/TypeList';
import { SearchBar } from '../../SearchBar';
import useDebouncedInput from '../../../hooks/useDebouncedInput';
import { filterTypesByKeywordsAndObjectType } from '../../../utils/contentType';
import {
	buildActionGroups,
	consolidateItemActions,
	invokeActionChoice,
	invokeResolvedAction,
	type ConsolidatedItemPickerData
} from '../dataSources/actionAdapters';
import type { DataSourceActionChoice, DataSourceSelection, ResolvedDataSourceAction } from '../dataSources/types';
import Alert from '@mui/material/Alert';
import GroupedDataSourceActionMenuItems from '../components/GroupedDataSourceActionMenuItems';

const SortableList = lazy(() => import('../components/SortableList'));
const TouchSortableList = lazy(() => import('../components/TouchSortableList'));

export interface NodeSelectorProps extends ControlProps {
	value: NodeSelectorItem[];
}

export interface NodeSelectorItem {
	key: string;
	value: string;
	include?: string;
	disableFlattening?: boolean;
	component?: Record<string, Primitive>;
	// @see https://craftercms.com/docs/current/by-role/developer/common/content-modeling/content-modeling.html#form-control-variable-names
	// _smv: When using single multi-value mode (neither useSingleValueFilename nor useMVS is true).
	fileSize_smv?: number;
	fileType_smv?: string;
	// _mvs: when using multi-value support mode (useMVS is true).
	fileType_mvs?: string;
	// _s When using single value filename mode (useSingleValueFilename is true).
	fileType_s?: string;
	// _s when using single value filename mode or multi-value support mode (useMVS is true).
	fileSize_s?: number;
}

export type DataSourcePickerType = 'search' | 'browse' | 'create' | 'upload';

export type AllowedContentTypesDataWithDestinations = AllowedContentTypesData & { createPaths?: string[] };

export interface AllowedPathsData {
	path: string;
	title: string;
	actionChoice?: DataSourceActionChoice;
	allowedContentTypes?: string[];
	options?: {
		sortBy?: string;
		sortOrder?: 'asc' | 'desc';
	};
}

type ContentCreationStrategy = 'embedded' | 'shared';

interface CreateDataSourcePickerData {
	path: string;
	strategy: ContentCreationStrategy;
	contentTypeId: string;
	actionKey?: string;
}

const oppositeStrategy: Record<ContentCreationStrategy, ContentCreationStrategy> = {
	embedded: 'shared',
	shared: 'embedded'
};

function getInitialCreatePickerValue(
	types: string[],
	lookup: LookupTable<AllowedContentTypesDataWithDestinations>
): CreateDataSourcePickerData {
	return types.length
		? {
				path: lookup[types[0]].createPaths?.[0] ?? '',
				strategy: lookup[types[0]].embedded ? 'embedded' : 'shared',
				contentTypeId: types[0]
			}
		: null;
}

function NodeSelector(props: NodeSelectorProps) {
	const { field, value, setValue, readonly: formReadonly, autoFocus, dataSources } = props;

	// region field properties/validations
	const readonly: boolean = isFieldReadOnly(field, formReadonly);
	const disableFlattening: boolean = getValidationValue(field.validations, 'disableFlattening', false);
	const useSingleValueFilename: boolean = getValidationValue(field.validations, 'useSingleValueFilename', false);
	const useMVS: boolean = getValidationValue(field.validations, 'useMVS', false);
	const allowDuplicates: boolean = getValidationValue(field.validations, 'allowDuplicates', false);
	// endregion

	useFetchContentItems(value.flatMap((item) => item.include ?? []));
	const [sortMode, setSortMode] = useState(false);
	const useTouchSorting = useMemo(() => isTouchDevice(), []);
	const handleCancelReorder = () => setSortMode(false);
	const onReorder = () => setSortMode(true);
	const itemsByPath = useItemsByPath();
	const user = useActiveUser();
	const contextItem = useItemContext();
	const { id, pathInSite } = useItemMetaContext();
	const api = useStableGlobalApiContext();
	const hasContent = Boolean(value.length);
	const [addMenuOpen, setAddMenuOpen] = useState(false);
	const [pickerType, setPickerType] = useState<DataSourcePickerType>(null);
	const [pickerDialogOpen, setPickerDialogOpen] = useState(false);
	const [createPickerChoice, setCreatePickerChoice] = useState<CreateDataSourcePickerData>(null);
	const dispatch = useDispatch();
	const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLButtonElement | null>(null);
	const contentTypes = useContentTypes();
	const siteId = useActiveSiteId();
	const authoringBase = useSelection((state) => state.env.authoringBase);
	const dataSourceSummary = useMemo(() => consolidateItemActions(dataSources?.actions ?? []), [dataSources?.actions]);
	const customActions = useMemo(
		() => buildActionGroups(dataSources?.actions ?? []).customActions,
		[dataSources?.actions]
	);
	const createActions = useMemo(
		() =>
			(dataSources?.actions ?? []).filter((action) => action.kind === 'create' && !action.MenuItem && !action.Dialog),
		[dataSources?.actions]
	);
	const handleRemoveItem = (event: ReactMouseEvent, index: number) => {
		event.stopPropagation();
		const nextValue = value.concat();
		nextValue.splice(index, 1);
		setValue(nextValue);
	};
	const handleViewItem = (event: { stopPropagation(): void }, index: number) => {
		event.stopPropagation();
		const item: ContentItem = itemsByPath[value[index].key];

		if (!item) {
			console.error('Item not found:', value[index].key);
			return;
		}

		if (isEditableViaFormEditor(item)) {
			// If the item is editable via form editor (page, component or taxonomy), open the form editor in read-only mode
			dispatch(pickShowContentFormAction({ path: item.path, authoringBase, site: siteId, readonly: true }));
		} else {
			// Otherwise, open the preview dialog, it may be a preview of media (image, video, audio) or document (pdf) or code editor for other text-based files
			const dialogProps =
				isMediaContent(item.mimeType) || isPdfDocument(item.mimeType)
					? {
							type: isImage(item) ? 'image' : isVideo(item) ? 'video' : isAudio(item) ? 'audio' : 'pdf',
							title: item.label,
							url: item.path
						}
					: {
							type: 'editor',
							title: item.label,
							url: item.path,
							path: item.path,
							mode: getItemEditorMode(item)
						};

			dispatch(
				pushDialog({
					component: createComponentId('PreviewDialog'),
					allowMinimize: true,
					allowFullScreen: true,
					props: dialogProps
				})
			);
		}
	};
	const handleEditItem = (event: { stopPropagation(): void }, index: number, edit: boolean = false) => {
		event.stopPropagation();
		const item: NodeSelectorItem = value[index];
		if (isItemComponent(item)) {
			const isEmbedded = Boolean(item.component);
			api.pushForm({
				readonly: !edit,
				update: {
					path: item.include ?? contextItem.path,
					// In the case of shared, item.component === undefined.
					// The form interprets as a shared when modelId and values are not supplied and fetches.
					modelId: isEmbedded ? (item.key as string | undefined) : undefined,
					values: item.component
				},
				onSave({ values, path }) {
					let key = isEmbedded
						? ((values[XmlKeys.fileName] || values.objectId) as string).replace(/\.xml$/, '')
						: item.include;

					if (!isEmbedded) {
						// Check if the path has changed (moved/renamed) and update key accordingly.
						const currentPath = item.key;
						if (path && currentPath !== path) {
							key = path;
						}
					}

					const newItem: NodeSelectorItem = {
						key,
						value: values[XmlKeys.internalName] as string,
						[isEmbedded ? 'component' : 'include']: isEmbedded ? (values as LookupTable<Primitive>) : key,
						disableFlattening
					};
					const nextValue = value.concat();
					nextValue.splice(index, 1, newItem);
					setValue(nextValue);
					return Promise.resolve({ close: true });
				}
			});
		} else {
			dispatch(
				showCodeEditorDialog({
					path: item.include,
					mode: getEditorMode(itemsByPath[item.include]?.mimeType ?? 'text/plain')
				})
			);
		}
	};
	const handleItemKeyDown = (e: KeyDownEvent, index: number) => {
		sortableListKeyDownHandler(
			e,
			value,
			index,
			(newList) => setValue(newList),
			(index, edit) => handleEditItem(e, index, edit && !readonly)
		);
	};
	const applyDataSourceSelection = (
		selection: DataSourceSelection | DataSourceSelection[] | null,
		createChoice?: CreateDataSourcePickerData
	) => {
		const selections = Array.isArray(selection) ? selection : selection ? [selection] : [];
		const newItems = selections.flatMap<NodeSelectorItem>((selected) => {
			if (selected.kind !== 'item' && selected.kind !== 'asset') return [];
			const path =
				selected.kind === 'asset' && typeof selected.relativeUrl === 'string'
					? selected.relativeUrl
					: selected.kind === 'item' && typeof selected.path === 'string'
						? selected.path
						: undefined;
			const createdValues =
				selected.kind === 'item' && selected.value && typeof selected.value === 'object'
					? (selected.value as LookupTable<Primitive>)
					: null;
			const embedded = createChoice?.strategy === 'embedded';
			const key = embedded ? (createdValues?.objectId as string) : path;
			if (!key) return [];
			const fallbackName = key.split('/').filter(Boolean).pop() ?? key;
			const label =
				(createdValues?.[XmlKeys.internalName] as string) ||
				(selected.kind === 'item' && typeof selected.value === 'string' ? selected.value : fallbackName);
			const fileType = getFileExtension(key);
			return [
				{
					key,
					value: label,
					...(embedded
						? { component: createdValues }
						: {
								include: key,
								...(fileType ? getFileMetaData({ fileType, useSingleValueFilename, useMVS }) : {})
							}),
					disableFlattening
				}
			];
		});
		const { validItems, duplicateItems } = validateNewItems(newItems, value, allowDuplicates);
		if (newItems.length) setValue(validItems);
		if (!allowDuplicates && duplicateItems.length) showDuplicatesWarning(dispatch, duplicateItems);
	};
	const executeDataSourceOption = (
		optionType: DataSourcePickerType,
		choice: AllowedPathsData | CreateDataSourcePickerData
	) => {
		const processPath = (path: string) =>
			processPathMacros({ path, objectId: id, fullParentPath: contextItem?.path ?? pathInSite });
		switch (optionType) {
			case 'browse': {
				const pickerChoice = choice as AllowedPathsData;
				if (pickerChoice.actionChoice && dataSources?.context) {
					invokeActionChoice(pickerChoice.actionChoice, dataSources.context)
						.then(applyDataSourceSelection)
						.catch(console.error);
					break;
				}
				// Compatibility fallback for legacy callers that don't provide owner-bound actions.
				showBrowseFilesDialog({
					dispatch,
					path: processPath(pickerChoice.path),
					contentTypes: pickerChoice.allowedContentTypes,
					preselectedPaths: allowDuplicates ? [] : value.map((item) => item.key).filter(Boolean),
					initialParameters: {
						sortBy: pickerChoice.options?.sortBy,
						sortOrder: pickerChoice.options?.sortOrder
					},
					onSuccess(items: MediaItem | MediaItem[]) {
						const newNodeSelectorItems = [];
						asArray(items).forEach((item) => {
							const fileType = getFileExtension(item.name);
							newNodeSelectorItems.push({
								key: item.path,
								value: item.name,
								include: item.path,
								disableFlattening,
								...(fileType ? getFileMetaData({ fileType, useSingleValueFilename, useMVS }) : {})
							});
						});
						const { validItems, duplicateItems } = validateNewItems(newNodeSelectorItems, value, allowDuplicates);
						setValue(validItems);
						if (!allowDuplicates && duplicateItems.length) showDuplicatesWarning(dispatch, duplicateItems);
					}
				});
				break;
			}
			case 'search': {
				const pickerChoice = choice as AllowedPathsData;
				if (pickerChoice.actionChoice && dataSources?.context) {
					invokeActionChoice(pickerChoice.actionChoice, dataSources.context)
						.then(applyDataSourceSelection)
						.catch(console.error);
					break;
				}
				// Compatibility fallback for legacy callers that don't provide owner-bound actions.
				showSearchDialog({
					dispatch,
					path: ensureSingleSlash(`${processPath(pickerChoice.path)}/.+`),
					contentTypes: pickerChoice.allowedContentTypes,
					preselectedPaths: value.map((item) => item.key).filter(Boolean),
					initialParameters: {
						sortBy: pickerChoice.options?.sortBy,
						sortOrder: pickerChoice.options?.sortOrder
					},
					onAcceptSelection(paths, items) {
						const newNodeSelectorItems = [];
						items?.forEach((item) => {
							newNodeSelectorItems.push({
								key: item.path,
								value: item.name,
								include: item.path,
								disableFlattening
							});
						});
						const { validItems, duplicateItems } = validateNewItems(newNodeSelectorItems, value, allowDuplicates);
						setValue(validItems);
						if (!allowDuplicates && duplicateItems.length) showDuplicatesWarning(dispatch, duplicateItems);
					}
				});
				break;
			}
			case 'create': {
				const pickerChoice = choice as CreateDataSourcePickerData;
				const isEmbedded = pickerChoice.strategy === 'embedded';
				const owner = findCreateAction(dataSources?.actions ?? [], pickerChoice);
				if (owner && dataSources?.context) {
					invokeResolvedAction(owner, dataSources.context, {
						type: 'create',
						contentTypeId: pickerChoice.contentTypeId,
						path: pickerChoice.strategy === 'embedded' ? contextItem.path : pickerChoice.path,
						strategy: pickerChoice.strategy
					})
						.then((selection) => applyDataSourceSelection(selection, pickerChoice))
						.catch(console.error);
					break;
				}
				// Compatibility fallback for legacy callers that don't provide owner-bound actions.
				// Push to form stack a new form in create mode with the selected content type
				api.pushForm({
					create: {
						contentTypeId: pickerChoice.contentTypeId,
						path: pickerChoice.strategy === 'embedded' ? contextItem.path : processPath(pickerChoice.path),
						embedded: isEmbedded
					},
					onSave(result) {
						const key = isEmbedded ? (result.values.objectId as string) : result.path;
						const newItem: NodeSelectorItem = {
							key,
							value: result.values[XmlKeys.internalName] as string,
							[isEmbedded ? 'component' : 'include']: isEmbedded ? (result.values as LookupTable<Primitive>) : key,
							disableFlattening
						};
						const { validItems, duplicateItems } = validateNewItems([newItem], value, allowDuplicates);
						setValue(validItems);
						if (!allowDuplicates && duplicateItems.length) showDuplicatesWarning(dispatch, duplicateItems);
						return Promise.resolve({ close: true });
					}
				});
				break;
			}
			case 'upload': {
				const pickerChoice = choice as AllowedPathsData;
				if (pickerChoice.actionChoice && dataSources?.context) {
					invokeActionChoice(pickerChoice.actionChoice, dataSources.context)
						.then(applyDataSourceSelection)
						.catch(console.error);
					break;
				}
				// Compatibility fallback for legacy callers that don't provide owner-bound actions.
				showUploadDialog({
					dispatch,
					path: processPath(choice.path),
					siteId,
					onUploadComplete: (result: FileUploadResult) => {
						if (result.successful.length) {
							const newNodeSelectorItems = [];
							asArray(result.successful).forEach((item) => {
								const fileType = item.extension;
								const fileSize = item.size;
								const value = ensureSingleSlash(`${item.meta.path}/${item.meta.name}`);
								newNodeSelectorItems.push({
									key: value,
									value: item.meta.name,
									include: value,
									disableFlattening,
									...(fileType ? getFileMetaData({ fileType, fileSize, useSingleValueFilename, useMVS }) : {})
								});
							});
							const { validItems, duplicateItems } = validateNewItems(newNodeSelectorItems, value, allowDuplicates);
							setValue(validItems);
							if (!allowDuplicates && duplicateItems.length) showDuplicatesWarning(dispatch, duplicateItems);
						}
					}
				});
				break;
			}
		}
	};
	const handleCloseDataSourcePickerDialog = () => setPickerDialogOpen(false);
	const handleDataSourceOptionClick = (
		event: ReactMouseEvent<HTMLLIElement, MouseEvent>,
		option: DataSourcePickerType
	) => {
		setAddMenuOpen(false);
		switch (option) {
			case 'browse': {
				if (allowedBrowsePaths.length === 1) {
					executeDataSourceOption('browse', allowedBrowsePaths[0]);
				} else {
					// Open browse picker
					setPickerType('browse');
					setPickerDialogOpen(true);
				}
				break;
			}
			case 'search': {
				if (allowedSearchPaths.length === 1) {
					executeDataSourceOption('search', allowedSearchPaths[0]);
				} else {
					// Open search picker
					setPickerType('search');
					setPickerDialogOpen(true);
				}
				break;
			}
			case 'create': {
				const allowedCreateTypesIds = Object.keys(allowedCreateTypes);
				const contentTypeId = allowedCreateTypesIds[0];
				// If there's only one option, use that option, otherwise, will show the picker.
				if (
					// Only one content type is allowed
					allowedCreateTypesIds.length === 1 &&
					// Only one strategy is allowed
					[
						allowedCreateTypes[contentTypeId].shared,
						allowedCreateTypes[contentTypeId].embedded,
						allowedCreateTypes[contentTypeId].sharedExisting
					].filter(Boolean).length === 1 &&
					// When strategy is shared, only one destination path is allowed
					(!allowedCreateTypes[contentTypeId].shared || allowedCreateTypes[contentTypeId].createPaths?.length === 1)
				) {
					const strategy = allowedCreateTypes[contentTypeId].embedded ? 'embedded' : 'shared';
					// Open create dialog
					executeDataSourceOption('create', {
						path: strategy === 'embedded' ? '' : allowedCreateTypes[contentTypeId].createPaths?.[0],
						strategy: strategy,
						contentTypeId
					});
				} else {
					// Open create picker
					setPickerType('create');
					setPickerDialogOpen(true);
				}
				break;
			}
			case 'upload': {
				if (allowedUploadPaths.length === 1) {
					executeDataSourceOption('upload', allowedUploadPaths[0]);
				} else {
					setPickerType('upload');
					setPickerDialogOpen(true);
				}
				break;
			}
		}
	};
	const handleDataSourcePickerDialogChange = (event, choice: AllowedPathsData | CreateDataSourcePickerData) => {
		switch (pickerType) {
			case 'search':
			case 'browse':
			case 'upload':
				executeDataSourceOption(pickerType, choice);
				setPickerDialogOpen(false);
				break;
			case 'create':
				setCreatePickerChoice(choice as CreateDataSourcePickerData);
				break;
		}
	};
	const handleDataSourcePickerDialogAccept = () => {
		setPickerDialogOpen(false);
		executeDataSourceOption('create', createPickerChoice);
	};
	const memoRefs = useUpdateRefs({ handleDataSourceOptionClick });
	const { menuOptions, availableOptions } = useMemo(
		() => createAddMenuOptions({ refs: memoRefs, itemPickerDataSourceData: dataSourceSummary, readonly }),
		[memoRefs, readonly, dataSourceSummary]
	);
	const { allowedCreateTypes, allowedCreatePaths, allowedBrowsePaths, allowedSearchPaths, allowedUploadPaths } =
		dataSourceSummary;
	const customActionItems =
		dataSources?.context && customActions.length ? (
			<GroupedDataSourceActionMenuItems
				actions={customActions}
				context={dataSources.context}
				disabled={readonly}
				onResult={applyDataSourceSelection}
				onError={console.error}
				onMenuClose={() => setAddMenuOpen(false)}
			/>
		) : null;
	const maxLimitReached = value.length >= field.validations.maxCount?.value;
	const isAddDisabled = readonly || maxLimitReached || (!menuOptions.length && !customActions.length);
	return (
		<>
			<Menu
				anchorEl={addMenuAnchor}
				open={addMenuOpen}
				onClose={() => {
					setAddMenuOpen(false);
					setAddMenuAnchor(null);
				}}
			>
				{menuOptions}
				{customActionItems}
			</Menu>
			<Dialog
				open={pickerDialogOpen}
				onClose={handleCloseDataSourcePickerDialog}
				fullWidth
				maxWidth={pickerType !== 'create' ? 'sm' : 'md'}
				slotProps={{
					paper: {
						sx: [pickerType === 'create' && { minHeight: '60vh' }]
					}
				}}
			>
				<DialogHeader
					title={<FormattedMessage defaultMessage="Choose how to proceed" />}
					onCloseButtonClick={handleCloseDataSourcePickerDialog}
				/>
				<DialogBody>
					{
						{
							browse: (
								<DataSourcePicker allowedPaths={allowedBrowsePaths} onChange={handleDataSourcePickerDialogChange} />
							),
							search: (
								<DataSourcePicker allowedPaths={allowedSearchPaths} onChange={handleDataSourcePickerDialogChange} />
							),
							upload: (
								<DataSourcePicker allowedPaths={allowedUploadPaths} onChange={handleDataSourcePickerDialogChange} />
							),
							create: (
								<CreateDataSourcePicker
									key={`${createActions.map((action) => action.actionKey).join(',')}::${allowedCreatePaths.join(',')}::${Object.keys(allowedCreateTypes).join(',')}`}
									siteId={siteId}
									allowedCreateTypes={allowedCreateTypes}
									allowedCreatePaths={allowedCreatePaths}
									createActions={createActions}
									contentTypesLookup={contentTypes}
									onChange={handleDataSourcePickerDialogChange}
								/>
							)
						}[pickerType]
					}
				</DialogBody>
				{pickerType === 'create' && (
					<DialogFooter>
						<SecondaryButton onClick={handleCloseDataSourcePickerDialog}>
							<FormattedMessage defaultMessage="Cancel" />
						</SecondaryButton>
						<PrimaryButton onClick={handleDataSourcePickerDialogAccept} disabled={!createPickerChoice?.contentTypeId}>
							<FormattedMessage defaultMessage="Accept" />
						</PrimaryButton>
					</DialogFooter>
				)}
			</Dialog>
			<Dialog open={sortMode} onClose={handleCancelReorder} maxWidth="xs" fullWidth>
				<DialogHeader
					title={field.name}
					rightActions={[{ text: <FormattedMessage defaultMessage="Done" />, onClick: handleCancelReorder }]}
				/>
				{useTouchSorting ? (
					<TouchSortableList items={value} onChange={setValue} />
				) : (
					<Suspense
						fallback={<SortableListSkeleton items={value} />}
						children={<SortableList items={value} onChange={setValue} />}
					/>
				)}
			</Dialog>
			<FormsEngineField
				field={field}
				min={field.validations.minCount?.value}
				max={field.validations.maxCount?.value}
				length={value.length}
				action={
					<Tooltip
						title={
							isAddDisabled ? (
								maxLimitReached ? (
									<FormattedMessage defaultMessage="Maximum amount of items reached" />
								) : (
									''
								)
							) : (
								<FormattedMessage defaultMessage="Add items" />
							)
						}
					>
						<span>
							<IconButton
								autoFocus={autoFocus}
								disabled={isAddDisabled}
								size="small"
								color="primary"
								onClick={(event) => {
									setAddMenuAnchor(event.currentTarget);
									if (availableOptions.length === 1 && customActions.length === 0) {
										handleDataSourceOptionClick(null, availableOptions[0]);
									} else {
										setAddMenuOpen(true);
									}
								}}
							>
								<AddRounded fontSize="small" />
							</IconButton>
						</span>
					</Tooltip>
				}
				menuOptions={
					readonly ? undefined : [{ id: 'reorder', text: <FormattedMessage defaultMessage="Reorder Items" /> }]
				}
				onMenuOptionClick={(_, __, closeMenu) => {
					onReorder();
					closeMenu();
				}}
			>
				{dataSources?.errors.map((error) => (
					<Alert key={`${error.code}-${error.dataSourceId}`} severity="error" sx={{ mb: 1 }}>
						{error.message}
					</Alert>
				))}
				<FieldBox dashed={!hasContent}>
					{hasContent ? (
						<List dense>
							{value.map((item, index) => {
								const isEmbedded = Boolean(item.component);
								const Icon = isEmbedded ? DeleteOutlined : LinkOffRoundedIcon;
								const iconTooltip = isEmbedded ? (
									<FormattedMessage defaultMessage="Delete" />
								) : (
									<FormattedMessage defaultMessage="Unlink" />
								);
								const isComponent = isItemComponent(item);
								const canBeEdited =
									// Is a component and is embedded or is shared, and user can edit it (has edit action and is not locked)
									(isComponent &&
										(isEmbedded ||
											(itemsByPath[item.include]?.availableActionsMap.edit &&
												(itemsByPath[item.include]?.lockOwner == null ||
													user.username === itemsByPath[item.include]?.lockOwner?.username)))) ||
									// is an editable asset, and the user can edit it (has edit action and is not locked)
									(!isComponent &&
										isEditableAsset(item.key) &&
										itemsByPath[item.include]?.availableActionsMap.edit &&
										(itemsByPath[item.include]?.lockOwner == null ||
											user.username === itemsByPath[item.include]?.lockOwner?.username));
								return (
									<ListItemButton
										key={`${item.key}-${index}`} // Including index in the key because there can be duplicate items (same item included more than once)
										divider={index !== value.length - 1}
										onClick={(e) => (canBeEdited ? handleEditItem(e, index, false) : handleViewItem(e, index))}
										onKeyDown={(e) => handleItemKeyDown(e, index)}
									>
										<ListItemText
											primary={
												isEmbedded ? (
													<ItemDisplay
														item={{
															...contextItem,
															label: item.value,
															systemType: 'component'
														}}
														showWorkflowState={!isEmbedded}
														showNavigableAsLinks={false}
													/>
												) : itemsByPath[item.include] ? (
													<ItemDisplay item={itemsByPath[item.include]} showNavigableAsLinks={false} />
												) : (
													item.value
												)
											}
											secondary={
												isEmbedded ? (
													<em>
														<FormattedMessage defaultMessage="Embedded" />
													</em>
												) : (
													(item.include ?? item.key)
												)
											}
										/>
										<ListItemSecondaryAction sx={{ position: 'static', display: 'flex', transform: 'none' }}>
											{canBeEdited ? (
												<Tooltip title="Edit">
													<IconButton size="small" onClick={(e) => handleEditItem(e, index, !readonly)}>
														<EditOutlined fontSize="small" />
													</IconButton>
												</Tooltip>
											) : (
												<Tooltip title="View">
													<IconButton size="small" onClick={(e) => handleViewItem(e, index)}>
														<VisibilityOutlinedIcon fontSize="small" />
													</IconButton>
												</Tooltip>
											)}
											{!readonly && (
												<Tooltip title={iconTooltip}>
													<IconButton size="small" onClick={(e) => handleRemoveItem(e, index)}>
														<Icon fontSize="small" />
													</IconButton>
												</Tooltip>
											)}
										</ListItemSecondaryAction>
									</ListItemButton>
								);
							})}
						</List>
					) : (
						<Box
							children={
								menuOptions.length || customActionItems ? (
									<>
										{menuOptions}
										{customActionItems}
									</>
								) : (
									<EmptyState
										key="emptyState"
										title={<FormattedMessage defaultMessage="No options are available for this control" />}
										subtitle={
											<FormattedMessage defaultMessage="Update the content type definition to add options to this control" />
										}
									/>
								)
							}
							sx={{
								p: 1,
								gap: 1,
								py: 0.5,
								display: 'flex',
								flexDirection: 'row',
								flexWrap: 'wrap',
								color: 'primary.main',
								justifyContent: 'center',
								[`.${svgIconClasses.root}`]: {
									color: 'primary.main'
								},
								[`.${menuItemClasses.root}`]: {
									flexDirection: 'column',
									justifyContent: 'center',
									borderRadius: 1
								},
								[`.${listItemIconClasses.root}`]: {
									justifyContent: 'center'
								}
							}}
						/>
					)}
				</FieldBox>
			</FormsEngineField>
		</>
	);
}

// Internal/private component
function CreateDataSourcePicker(props: {
	siteId: string;
	contentTypesLookup: LookupTable<ContentType>;
	allowedCreateTypes: LookupTable<AllowedContentTypesDataWithDestinations>;
	allowedCreatePaths: string[];
	createActions: readonly ResolvedDataSourceAction[];
	onChange(e, choice: CreateDataSourcePickerData): void;
}) {
	const { siteId, allowedCreatePaths, contentTypesLookup, createActions, onChange } = props;
	const [allowedTypes, setAllowedTypes] = useState<string[] | undefined>(() =>
		allowedCreatePaths.length ? undefined : Object.keys(props.allowedCreateTypes)
	);
	const [allowedCreateTypes, setAllowedCreateTypes] = useState<LookupTable<AllowedContentTypesDataWithDestinations>>(
		props.allowedCreateTypes
	);
	const [value, setValue] = useState<CreateDataSourcePickerData>(() =>
		getInitialCreatePickerValue(Object.keys(props.allowedCreateTypes), props.allowedCreateTypes)
	);
	const refs = useUpdateRefs({ value, onChange });
	const allowedStrategies = {
		embedded: Boolean(value && allowedCreateTypes[value.contentTypeId]?.embedded),
		shared: Boolean(value && allowedCreateTypes[value.contentTypeId]?.shared)
	};
	const handleTypeChange = (event: SyntheticEvent, contentType: ContentType) => {
		const rules = allowedCreateTypes[contentType.id] ?? {};
		const currentStrategy = value?.strategy ?? (rules.embedded ? 'embedded' : 'shared');
		const strategy = rules[currentStrategy] ? currentStrategy : oppositeStrategy[currentStrategy];
		const newValue = {
			...value,
			contentTypeId: contentType.id,
			strategy,
			path: rules.createPaths?.[0] ?? ''
		};
		setValue(newValue);
		onChange?.(event, newValue);
	};
	const handleStrategyChange = (event: SyntheticEvent) => {
		const strategy = (event.target as HTMLInputElement).value as ContentCreationStrategy;
		const newValue = {
			...value,
			strategy,
			path: strategy === 'shared' ? (allowedCreateTypes[value.contentTypeId].createPaths?.[0] ?? '') : ''
		};
		setValue(newValue);
		onChange?.(event, newValue);
	};
	const handlePathChange = (event: SyntheticEvent) => {
		const newValue = { ...value, path: (event.target as HTMLInputElement).value };
		setValue(newValue);
		onChange?.(event, newValue);
	};
	const handleActionChange = (event: SyntheticEvent) => {
		const newValue = { ...value, actionKey: (event.target as HTMLInputElement).value };
		setValue(newValue);
		onChange?.(event, newValue);
	};
	useEffect(() => {
		const allowedCreateTypes = props.allowedCreateTypes;
		if (allowedCreatePaths.length) {
			// Find out all the types that can be created on the allowed creation paths (coming from shared-content DS).
			const sub = forkJoin(allowedCreatePaths.map((path) => fetchAllowedTypes(siteId, path))).subscribe((responses) => {
				const allowedLookup: LookupTable<AllowedContentTypesDataWithDestinations> = { ...allowedCreateTypes };
				responses.forEach((types, index) => {
					// The path the types were fetched from is their creation destination.
					const path = allowedCreatePaths[index];
					types.forEach((contentTypeId) => {
						const entry = { ...allowedLookup[contentTypeId] };
						const createPaths = entry.createPaths ?? [];
						entry.shared = true;
						entry.createPaths = createPaths.includes(path) ? createPaths : createPaths.concat(path);
						allowedLookup[contentTypeId] = entry;
					});
				});
				const result = Object.keys(allowedLookup);
				setAllowedTypes(result);
				setAllowedCreateTypes(allowedLookup);
				setValue(getInitialCreatePickerValue(result, allowedLookup));
			});
			return () => sub.unsubscribe();
		}
	}, [allowedCreatePaths, props.allowedCreateTypes, refs, siteId]);
	const matchingCreateActions = useMemo(
		() => (value ? findCreateActions(createActions, value) : []),
		[createActions, value]
	);
	useEffect(() => {
		refs.current.onChange?.(null, value);
	}, [refs, value]);

	const [filteredTypes, setFilteredTypes] = useState<ContentType[] | undefined>(undefined);
	const [keywords, setKeywords] = useState<string>('');
	const onKeyword$ = useDebouncedInput((keywords) => {
		if (!allowedTypes) return;
		const types = filterTypesByKeywordsAndObjectType(
			allowedTypes.map((typeId) => contentTypesLookup[typeId]).filter(Boolean),
			keywords,
			'all'
		);
		setFilteredTypes(types);
	});

	const visibleTypes = filteredTypes ?? allowedTypes?.map((typeId) => contentTypesLookup[typeId]).filter(Boolean);

	const handleKeywordsChange = (value: string) => {
		setKeywords(value);
		onKeyword$.next(value);
	};

	if (!value) {
		// Types coming from creation paths are fetched, so there's nothing to pick until they arrive.
		return allowedTypes === undefined ? (
			<TypeList contentTypes={[]} compact skeleton />
		) : (
			<EmptyState title={<FormattedMessage defaultMessage="There are no content types available for creation." />} />
		);
	}

	return (
		<Grid container spacing={2} display="flex" flexDirection="column">
			<Grid>
				<FormControl sx={{ mb: 1, flexShrink: 0 }} fullWidth>
					<Box alignItems="center" display="flex">
						<FormLabel id="creationStrategyLabel">
							<FormattedMessage defaultMessage="Creation Strategy" />
						</FormLabel>
						<IconButton
							size="small"
							sx={{ ml: 1 }}
							color="primary"
							component="a"
							href="https://craftercms.com/docs/current/by-role/developer/common/content-modeling/content-modeling.html#shared-components-vs-embedded-components"
							target="_blank"
						>
							<HelpOutline fontSize="inherit" />
						</IconButton>
					</Box>
					<RadioGroup aria-labelledby="creationStrategyLabel" name="creationStrategy" value={value.strategy} row>
						<FormControlLabel
							value="embedded"
							disabled={!allowedStrategies.embedded}
							control={<Radio onChange={handleStrategyChange} />}
							label={<FormattedMessage defaultMessage="Embedded" />}
						/>
						<FormControlLabel
							disabled={!allowedStrategies.shared}
							value="shared"
							control={<Radio onChange={handleStrategyChange} />}
							label={<FormattedMessage defaultMessage="Shared" />}
						/>
					</RadioGroup>
				</FormControl>
			</Grid>
			{value.strategy === 'shared' && allowedCreateTypes[value.contentTypeId]?.createPaths?.length > 1 && (
				<Grid sx={{ display: 'flex', flexDirection: 'column' }}>
					<FormControl sx={{ mt: 1 }} fullWidth>
						<FormLabel id="creationPathLabel">
							<FormattedMessage defaultMessage="Creation Path" />
						</FormLabel>
						<RadioGroup aria-labelledby="creationPathLabel" name="creationPath" value={value.path} sx={{}}>
							{allowedCreateTypes[value.contentTypeId].createPaths.map((path) => (
								<FormControlLabel
									key={path}
									value={path}
									control={<Radio />}
									onChange={handlePathChange}
									label={<Typography noWrap maxWidth="100%" component="div" title={path} children={path} />}
									disableTypography
								/>
							))}
						</RadioGroup>
					</FormControl>
				</Grid>
			)}
			{matchingCreateActions.length > 1 && (
				<Grid sx={{ display: 'flex', flexDirection: 'column' }}>
					<FormControl sx={{ mt: 1 }} fullWidth>
						<FormLabel id="creationDataSourceLabel">
							<FormattedMessage defaultMessage="Data Source" />
						</FormLabel>
						<RadioGroup
							aria-labelledby="creationDataSourceLabel"
							name="creationDataSource"
							value={value.actionKey ?? matchingCreateActions[0]?.actionKey ?? ''}
						>
							{matchingCreateActions.map((action) => (
								<FormControlLabel
									key={action.actionKey}
									value={action.actionKey}
									control={<Radio />}
									onChange={handleActionChange}
									label={action.dataSourceTitle}
								/>
							))}
						</RadioGroup>
					</FormControl>
				</Grid>
			)}

			<Grid width="100%">
				<FormControl fullWidth>
					<FormLabel id="contentTypeLabel" sx={{ minHeight: 28, display: 'flex', alignItems: 'center' }}>
						<FormattedMessage defaultMessage="Content Type" />
					</FormLabel>
					<SearchBar
						keyword={keywords}
						onChange={(value) => handleKeywordsChange(value)}
						showActionButton={!isEmpty(keywords)}
						sxs={{
							root: {
								background: 'none !important',
								border: 'none !important',
								borderRadius: 0,
								boxShadow: 'none',
								flexGrow: 1,
								py: 1
							},
							inputInput: { padding: '8px 5px' }
						}}
					/>
					<TypeList
						contentTypes={visibleTypes}
						compact={true}
						onCardClick={handleTypeChange}
						selectedTypeId={value.contentTypeId}
						disableSelected={false}
						skeleton={allowedTypes === undefined}
					/>
				</FormControl>
			</Grid>
		</Grid>
	);
}

// Internal/private component
function DataSourcePicker(props: { allowedPaths: AllowedPathsData[]; onChange(e, choice: AllowedPathsData): void }) {
	const { allowedPaths, onChange } = props;
	const handleChange = (event: SyntheticEvent) =>
		onChange?.(event, allowedPaths[(event.target as HTMLInputElement).value]);
	return (
		<FormControl>
			<FormLabel id="dataSourcePickerLabel">
				<FormattedMessage defaultMessage="Available Settings" />
			</FormLabel>
			<RadioGroup aria-labelledby="dataSourcePickerLabel" name="dataSourceConfig">
				{allowedPaths?.map((data, index) => (
					<FormControlLabel
						disableTypography
						key={index}
						value={index}
						control={<Radio />}
						label={
							<Box display="flex" flexDirection="column">
								<Typography component="span" children={data.title} />
								<Typography variant="body2" color="textSecondary" component="span" children={data.path} />
							</Box>
						}
						onChange={handleChange}
					/>
				))}
			</RadioGroup>
		</FormControl>
	);
}

function findCreateAction(
	actions: readonly ResolvedDataSourceAction[],
	choice: CreateDataSourcePickerData
): ResolvedDataSourceAction | undefined {
	const matches = findCreateActions(actions, choice);
	return matches.find((action) => action.actionKey === choice.actionKey) ?? matches[0];
}

function findCreateActions(
	actions: readonly ResolvedDataSourceAction[],
	choice: CreateDataSourcePickerData
): ResolvedDataSourceAction[] {
	return actions.filter((action) => {
		if (action.kind !== 'create') return false;
		const matchesTarget = action.meta?.createTargets?.some(
			(target) =>
				target.contentTypeId === choice.contentTypeId &&
				target.strategy === choice.strategy &&
				(choice.strategy === 'embedded' || target.path === choice.path)
		);
		const matchesCreatePath =
			choice.strategy === 'shared' && action.meta?.createPaths?.some((path) => path === choice.path);
		return matchesTarget || matchesCreatePath;
	});
}

function createAddMenuOptions({
	refs,
	readonly,
	itemPickerDataSourceData
}: {
	refs: RefObject<{
		handleDataSourceOptionClick(event: ReactMouseEvent<HTMLLIElement, MouseEvent>, option: DataSourcePickerType): void;
	}>;
	itemPickerDataSourceData: ConsolidatedItemPickerData;
	readonly: boolean;
}): {
	menuOptions: ReactNode[];
	availableOptions: DataSourcePickerType[];
} {
	const { allowedCreateTypes, allowedCreatePaths, allowedBrowsePaths, allowedSearchPaths, allowedUploadPaths } =
		itemPickerDataSourceData;
	// Data sources may enable creation without naming a content type (e.g. shared-content with no default
	// type), in which case they only contribute the destination path and the types allowed there are
	// resolved when the picker opens.
	const createAllowed = Object.keys(allowedCreateTypes).length > 0 || allowedCreatePaths.length > 0;
	const menuOptions = [];

	const availableOptions: DataSourcePickerType[] = [];
	if (allowedSearchPaths.length > 0) availableOptions.push('search');
	if (allowedBrowsePaths.length > 0) availableOptions.push('browse');
	if (allowedUploadPaths.length > 0) availableOptions.push('upload');
	if (createAllowed) availableOptions.push('create');

	if (availableOptions.includes('search')) {
		menuOptions.push(
			<MenuItem
				key="search"
				disabled={readonly}
				onClick={(event) => refs.current.handleDataSourceOptionClick(event, 'search')}
			>
				<ListItemIcon sx={{ mr: 0 }}>
					<SearchRounded fontSize="small" />
				</ListItemIcon>
				<ListItemText children={<FormattedMessage defaultMessage="Search" />} />
			</MenuItem>
		);
	}
	if (availableOptions.includes('browse')) {
		menuOptions.push(
			<MenuItem
				key="browse"
				disabled={readonly}
				onClick={(event) => refs.current.handleDataSourceOptionClick(event, 'browse')}
			>
				<ListItemIcon sx={{ mr: 0 }}>
					<TravelExploreOutlined fontSize="small" />
				</ListItemIcon>
				<ListItemText children={<FormattedMessage defaultMessage="Browse" />} />
			</MenuItem>
		);
	}
	if (availableOptions.includes('upload')) {
		menuOptions.push(
			<MenuItem
				key="upload"
				disabled={readonly}
				onClick={(event) => refs.current.handleDataSourceOptionClick(event, 'upload')}
			>
				<ListItemIcon sx={{ mr: 0 }}>
					<UploadFileOutlinedIcon fontSize="small" />
				</ListItemIcon>
				<ListItemText children={<FormattedMessage defaultMessage="Upload" />} />
			</MenuItem>
		);
	}
	if (createAllowed) {
		menuOptions.push(
			<MenuItem
				key="create"
				disabled={readonly}
				onClick={(event) => refs.current.handleDataSourceOptionClick(event, 'create')}
			>
				<ListItemIcon sx={{ mr: 0 }}>
					<AddRounded fontSize="small" />
				</ListItemIcon>
				<ListItemText children={<FormattedMessage defaultMessage="Create" />} />
			</MenuItem>
		);
	}

	return { menuOptions, availableOptions };
}

function showUploadDialog({
	dispatch,
	path,
	siteId,
	onUploadComplete
}: {
	dispatch: ReduxDispatch;
	path: string;
	siteId: string;
	onUploadComplete: SingleFileUploadDialogProps['onUploadComplete'];
}) {
	const id = nanoid();
	dispatch(
		pushDialog({
			id,
			component: 'craftercms.components.SingleFileUploadDialog',
			props: {
				site: siteId,
				path,
				onUploadComplete: (result: FileUploadResult) => {
					onUploadComplete(result);
					dispatch(popDialog({ id }));
				}
			} as SingleFileUploadDialogProps
		})
	);
}

type FileMetadata = {
	fileType_smv?: string;
	fileSize_smv?: number;
	fileType_mvs?: string;
	fileType_s?: string;
	fileSize_s?: number;
};

/**
 * Returns an object with the appropriate file metadata fields based on the configuration.
 * @param fileType {string} - The file type (e.g., 'jpg', 'png').
 * @param fileSize {number} - The file size (e.g., 2048).
 * @param useSingleValueFilename {boolean} - Whether single value filename is used.
 * @param useMVS {boolean} - Whether multi-value support is used.
 * @returns {FileMetadata} An object containing the appropriate file metadata fields.
 * */
function getFileMetaData({
	fileType,
	fileSize,
	useSingleValueFilename,
	useMVS
}: {
	fileType: string;
	fileSize?: number;
	useSingleValueFilename: boolean;
	useMVS: boolean;
}): FileMetadata {
	const metaData: FileMetadata = {};
	if (!useSingleValueFilename && !useMVS) {
		metaData['fileType_smv'] = fileType;
		if (fileSize) metaData['fileSize_smv'] = fileSize;
	} else if (useMVS) {
		metaData['fileType_mvs'] = fileType;
		if (fileSize) metaData['fileSize_s'] = fileSize;
	} else if (useSingleValueFilename) {
		metaData['fileType_s'] = fileType;
		if (fileSize) metaData['fileSize_s'] = fileSize;
	}
	return metaData;
}

/**
 * Validates if a NodeSelectorItem represents a component (embedded or shared).
 *
 * @param item {NodeSelectorItem} - The NodeSelectorItem to validate.
 * @returns {boolean} True if the item is a component, false otherwise.
 */
function isItemComponent(item: NodeSelectorItem): boolean {
	return Boolean(
		// There are 3 scenarios when an item is considered a component:
		// 1. It has the 'component' property (embedded component).
		// 2. It has an 'include' property that starts with '/site/' (shared component).
		// 3. It has an 'include' property that does not point to an editable asset (shared component).
		item.component || (item.include && (item.include.startsWith('/site/') || !isEditableAsset(item.include)))
	);
}

/**
 * Validates and separates new items into valid and duplicate categories.
 * When allowDuplicates is true, validItems includes all items (existing + new, including duplicates).
 * When allowDuplicates is false, validItems excludes duplicate new items.
 *
 * @param newItems {NodeSelectorItem[]} - The array of new items to validate.
 * @param items {NodeSelectorItem[]} - The existing array of items to compare against.
 * @param allowDuplicates {boolean} - A flag indicating whether duplicates are allowed.
 * @returns {Object} An object containing two arrays:
 *   - `validItems`: All existing items plus new items (includes duplicates if allowDuplicates is true).
 *   - `duplicateItems`: The array of items that were identified as duplicates.
 */
function validateNewItems(
	newItems: NodeSelectorItem[],
	items: NodeSelectorItem[],
	allowDuplicates: boolean
): {
	validItems: NodeSelectorItem[];
	duplicateItems: NodeSelectorItem[];
} {
	const validItems: NodeSelectorItem[] = [...items];
	const duplicateItems: NodeSelectorItem[] = [];

	newItems.forEach((newItem) => {
		const isDuplicate = validItems.find((item) => item.key === newItem.key);
		if (isDuplicate) {
			duplicateItems.push(newItem);
			if (allowDuplicates) validItems.push(newItem);
		} else {
			validItems.push(newItem);
		}
	});

	return { validItems, duplicateItems };
}

/**
 * Displays a warning message for duplicate items that were not added.
 *
 * @param dispatch {ReduxDispatch} - The Redux dispatch function used to trigger the alert.
 * @param duplicateItems {NodeSelectorItem[]} - An array of duplicate items that were not added.
 */
function showDuplicatesWarning(dispatch: ReduxDispatch, duplicateItems: NodeSelectorItem[]) {
	if (duplicateItems.length) {
		showAlert({
			message: 'The following items are duplicates and were not added:',
			children: (
				<List>
					{duplicateItems.map((item) => (
						<ListItemText
							key={item.key}
							primary={item.value}
							secondary={item.include}
							slotProps={{
								primary: { noWrap: true },
								secondary: { noWrap: true }
							}}
						/>
					))}
				</List>
			),
			dispatch
		});
	}
}

export default NodeSelector;
