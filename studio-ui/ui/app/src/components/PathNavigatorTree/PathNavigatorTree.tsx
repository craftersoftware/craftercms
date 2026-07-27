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

import React, { useEffect, useRef, useState } from 'react';
import PathNavigatorTreeUI, { PathNavigatorTreeUIProps } from './PathNavigatorTreeUI';
import { useDispatch } from 'react-redux';
import {
	pathNavigatorTreeCollapsePath,
	pathNavigatorTreeExpandPath,
	pathNavigatorTreeFetchPathChildren,
	pathNavigatorTreeFetchPathPage,
	pathNavigatorTreeInit,
	pathNavigatorTreeRefresh,
	pathNavigatorTreeSetKeyword,
	pathNavigatorTreeToggleCollapsed
} from '../../state/actions/pathNavigatorTree';
import { StateStylingProps } from '../../models/UiConfig';
import LookupTable from '../../models/LookupTable';
import {
	getEditorMode,
	isEditableViaFormEditor,
	isImage,
	isMediaContent,
	isNavigable,
	isPreviewable
} from '../PathNavigator/utils';
import ContextMenu, { ContextMenuOption } from '../ContextMenu/ContextMenu';
import { getNumOfMenuOptionsForItem, isAudio, isPdfDocument, isVideo, lookupItemByPath } from '../../utils/content';
import { previewItem } from '../../state/actions/preview';
import { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import { getStoredPathNavigatorTree } from '../../utils/state';
import GlobalState from '../../models/GlobalState';
import PathNavigatorSkeleton from '../PathNavigator/PathNavigatorSkeleton';
import { ContentItem } from '../../models/Item';
import { SystemIconDescriptor } from '../SystemIcon';
import { useSelection } from '../../hooks/useSelection';
import { useEnv } from '../../hooks/useEnv';
import { useActiveUser } from '../../hooks/useActiveUser';
import { useItemsByPath } from '../../hooks/useItemsByPath';
import { useSubject } from '../../hooks/useSubject';
import { debounceTime } from 'rxjs/operators';
import { useActiveSite } from '../../hooks/useActiveSite';
import { ApiResponse, GetChildrenOptions, PartialSxRecord } from '../../models';
import SystemType from '../../models/SystemType';
import { PathNavigatorTreeItemProps } from './PathNavigatorTreeItem';
import { UNDEFINED } from '../../utils/constants';
import SimpleAjaxError from '../../models/SimpleAjaxError';
import { createComponentId, pickShowContentFormAction } from '../../utils/system';
import { pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { showItemMegaMenu } from '../../state/actions/dialogs';
import usePossibleTranslation from '../../hooks/usePossibleTranslation';
import TranslationOrText from '../../models/TranslationOrText';
import { useIntl } from 'react-intl';

export interface PathNavigatorTreeProps
	extends Pick<
		PathNavigatorTreeItemProps,
		'showNavigableAsLinks' | 'showPublishingTarget' | 'showWorkflowState' | 'showItemMenu'
	> {
	id: string;
	label: TranslationOrText;
	rootPath: string;
	sortStrategy?: GetChildrenOptions['sortStrategy'];
	order?: GetChildrenOptions['order'];
	excludes?: string[];
	limit?: number;
	icon?: SystemIconDescriptor;
	expandedIcon?: SystemIconDescriptor;
	collapsedIcon?: SystemIconDescriptor;
	container?: Partial<StateStylingProps>;
	initialCollapsed?: boolean;
	collapsible?: boolean;
	initialSystemTypes?: SystemType[];
	initialExpanded?: string[];
	onNodeClick?: PathNavigatorTreeUIProps['onLabelClick'];
	active?: PathNavigatorTreeItemProps['active'];
	classes?: Partial<Record<'header', string>>;
	sxs?: PartialSxRecord<'header'>;
}

export interface PathNavigatorTreeStateProps {
	id: string;
	rootPath: string;
	collapsed: boolean;
	limit: number;
	expanded: string[];
	childrenByParentPath: LookupTable<string[]>;
	errorByPath: Record<string, SimpleAjaxError>;
	keywordByPath: LookupTable<string>;
	totalByPath: LookupTable<number>;
	offsetByPath: LookupTable<number>;
	excludes: string[];
	systemTypes: SystemType[];
	error: ApiResponse;
	isRootPathMissing: boolean;
	sortStrategy: GetChildrenOptions['sortStrategy'];
	order: GetChildrenOptions['order'];
}

interface Menu {
	path?: string;
	sections?: ContextMenuOption[][];
	anchorEl: Element;
	loaderItems?: number;
}

// @see https://github.com/craftersoftware/craftercms/issues/5360
// const translations = defineMessages({
//   refresh: {
//     id: 'words.refresh',
//     defaultMessage: 'Refresh'
//   }
// });
//
// const menuOptions: LookupTable<ContextMenuOptionDescriptor> = {
//   refresh: {
//     id: 'refresh',
//     label: translations.refresh
//   }
// };

export function PathNavigatorTree(props: PathNavigatorTreeProps) {
	const { formatMessage } = useIntl();
	const translatedLabel = usePossibleTranslation(props.label) || formatMessage({ defaultMessage: '(No name)' });
	// region const { ... } = props;
	const {
		rootPath,
		id = rootPath,
		excludes,
		limit = 10,
		icon,
		expandedIcon,
		collapsedIcon,
		container,
		initialExpanded,
		initialCollapsed = true,
		collapsible = true,
		initialSystemTypes,
		onNodeClick,
		active,
		classes,
		showNavigableAsLinks,
		showPublishingTarget,
		showWorkflowState,
		showItemMenu,
		sortStrategy,
		order,
		sxs
	} = props;
	// endregion
	const state = useSelection((state) => state.pathNavigatorTree[id]);
	const { id: siteId, uuid } = useActiveSite();
	const user = useActiveUser();
	const onSearch$ = useSubject<{ keyword: string; path: string }>();
	const uiConfig = useSelection<GlobalState['uiConfig']>((state) => state.uiConfig);
	const [widgetMenu, setWidgetMenu] = useState<Menu>({ anchorEl: null, sections: [] });
	const { authoringBase } = useEnv();
	const dispatch = useDispatch();
	const itemsByPath = useItemsByPath();
	const initialRefs = useRef({ initialCollapsed, initialSystemTypes, limit, excludes, initialExpanded });
	const keywordByPath = state?.keywordByPath;
	const totalByPath = state?.totalByPath;
	const childrenByParentPath = state?.childrenByParentPath;
	const errorByPath = state?.errorByPath;
	const getItemByPath = (path: string) => lookupItemByPath(path, itemsByPath);
	const rootItem = getItemByPath(rootPath);

	useEffect(() => {
		// Adding uiConfig as means to stop navigator from trying to
		// initialize with previous state information when switching sites
		if (rootPath !== state?.rootPath && uiConfig.currentSite === siteId) {
			const storedState = getStoredPathNavigatorTree(uuid, user.username, id);
			const { initialSystemTypes, initialCollapsed, limit, excludes, initialExpanded } = initialRefs.current;
			dispatch(
				pathNavigatorTreeInit({
					id,
					rootPath,
					excludes,
					limit,
					collapsed: initialCollapsed,
					systemTypes: initialSystemTypes,
					expanded: initialExpanded,
					sortStrategy,
					order,
					...storedState
				})
			);
		}
	}, [dispatch, id, rootPath, siteId, state?.rootPath, uiConfig.currentSite, user.username, uuid, sortStrategy, order]);

	useEffect(() => {
		const subscription = onSearch$.pipe(debounceTime(400)).subscribe(({ keyword, path }) => {
			dispatch(
				pathNavigatorTreeSetKeyword({
					id,
					path,
					keyword
				})
			);
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [dispatch, id, onSearch$, rootPath]);

	// If there is no state yet, or if the root item is nullish and the rootPath is not missing, show loading skeleton.
	if (!state || (!rootItem && !state.isRootPathMissing)) {
		const storedState = getStoredPathNavigatorTree(uuid, user.username, id);
		return <PathNavigatorSkeleton renderBody={storedState ? !storedState.collapsed : !initialCollapsed} />;
	}

	// region Handlers

	const onChangeCollapsed = (collapsed) => {
		collapsible && dispatch(pathNavigatorTreeToggleCollapsed({ id, collapsed }));
	};

	const onNodeLabelClick =
		onNodeClick ??
		((event: React.MouseEvent<Element, MouseEvent>, path: string) => {
			const item = getItemByPath(path);
			if (isNavigable(item)) {
				dispatch(previewItem({ item, newTab: event.ctrlKey || event.metaKey }));
			} else if (isPreviewable(item)) {
				onPreview(item);
			} else {
				onToggleNodeClick(path);
			}
		});

	const onToggleNodeClick = (path: string) => {
		// If the path is already expanded, should be collapsed
		if (state.expanded.includes(path)) {
			dispatch(pathNavigatorTreeCollapsePath({ id, path }));
		} else {
			if (getItemByPath(path)?.childrenCount) {
				// If the item's children have been loaded, should simply be expanded
				if (childrenByParentPath[path]) {
					dispatch(pathNavigatorTreeExpandPath({ id, path }));
				} else {
					// Children not fetched yet, should be fetched
					dispatch(pathNavigatorTreeFetchPathChildren({ id, path }));
				}
			}
		}
	};

	const onHeaderButtonClick = (element: Element) => {
		// @see https://github.com/craftersoftware/craftercms/issues/5360
		onWidgetOptionsClick('refresh');
		// setWidgetMenu({
		//   sections: [[toContextMenuOptionsLookup(menuOptions, formatMessage).refresh]],
		//   anchorEl: element
		// });
	};

	const onOpenItemMenu = (element: Element, path: string) => {
		const anchorRect = element.getBoundingClientRect();
		const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
		const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');
		dispatch(
			showItemMegaMenu({
				path,
				anchorReference: 'anchorPosition',
				anchorPosition: { top, left },
				loaderItems: getNumOfMenuOptionsForItem(getItemByPath(path))
			})
		);
	};

	const onCloseWidgetOptions = () => setWidgetMenu({ ...widgetMenu, anchorEl: null });

	const onWidgetOptionsClick = (option: string) => {
		onCloseWidgetOptions();
		if (option === 'refresh') {
			dispatch(
				pathNavigatorTreeRefresh({
					id
				})
			);
		}
	};

	const onFilterChange = (keyword: string, path: string) => {
		if (!state.expanded.includes(path)) {
			dispatch(
				pathNavigatorTreeExpandPath({
					id,
					path
				})
			);
		}

		onSearch$.next({ keyword, path });
	};

	const onMoreClick = (path: string) => {
		dispatch(pathNavigatorTreeFetchPathPage({ id, path }));
	};

	const onPreview = (item: ContentItem) => {
		if (isEditableViaFormEditor(item)) {
			dispatch(pickShowContentFormAction({ path: item.path, authoringBase, site: siteId, readonly: true }));
		} else if (isMediaContent(item.mimeType) || isPdfDocument(item.mimeType)) {
			dispatch(
				pushDialog({
					component: createComponentId('PreviewDialog'),
					allowMinimize: true,
					allowFullScreen: true,
					props: {
						type: isImage(item) ? 'image' : isVideo(item) ? 'video' : isAudio(item) ? 'audio' : 'pdf',
						title: item.label,
						url: item.path
					}
				})
			);
		} else {
			const mode = getEditorMode(item);
			dispatch(
				pushDialog({
					id: nanoid(),
					component: createComponentId('PreviewDialog'),
					allowMinimize: true,
					allowFullScreen: true,
					props: {
						type: 'editor',
						title: item.label,
						url: item.path,
						path: item.path,
						mode
					}
				})
			);
		}
	};
	// endregion

	return (
		<>
			<PathNavigatorTreeUI
				classes={{ header: classes?.header }}
				sxs={{ header: sxs?.header }}
				title={translatedLabel}
				active={active}
				icon={expandedIcon && collapsedIcon ? (state.collapsed ? collapsedIcon : expandedIcon) : icon}
				container={container}
				isCollapsed={state.collapsed}
				rootPath={rootPath}
				isRootPathMissing={state.isRootPathMissing}
				itemsByPath={itemsByPath}
				keywordByPath={keywordByPath}
				totalByPath={totalByPath}
				childrenByParentPath={childrenByParentPath}
				errorByPath={errorByPath}
				expandedNodes={state?.expanded}
				onIconClick={onToggleNodeClick}
				onLabelClick={onNodeLabelClick}
				onChangeCollapsed={onChangeCollapsed}
				onOpenItemMenu={onOpenItemMenu}
				onHeaderButtonClick={state.collapsed ? UNDEFINED : onHeaderButtonClick}
				onFilterChange={onFilterChange}
				onMoreClick={onMoreClick}
				showNavigableAsLinks={showNavigableAsLinks}
				showPublishingTarget={showPublishingTarget}
				showWorkflowState={showWorkflowState}
				showItemMenu={showItemMenu}
			/>
			<ContextMenu
				anchorEl={widgetMenu.anchorEl}
				options={widgetMenu.sections}
				open={Boolean(widgetMenu.anchorEl)}
				onClose={onCloseWidgetOptions}
				onMenuItemClicked={onWidgetOptionsClick}
			/>
		</>
	);
}

export default PathNavigatorTree;
