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

import React, { ChangeEvent, ElementType, useEffect, useState } from 'react';
import { ContentItem } from '../../models/Item';
import ContextMenu, { ContextMenuOption } from '../ContextMenu/ContextMenu';
import { useDispatch } from 'react-redux';
import { withIndex, withoutIndex } from '../../utils/path';
import {
	pathNavigatorBackgroundRefresh,
	pathNavigatorChangeLimit,
	pathNavigatorChangePage,
	pathNavigatorConditionallySetPath,
	pathNavigatorFetchPath,
	pathNavigatorInit,
	pathNavigatorItemChecked,
	pathNavigatorItemUnchecked,
	pathNavigatorRefresh,
	pathNavigatorSetCollapsed,
	pathNavigatorSetKeyword,
	pathNavigatorSetLocaleCode
} from '../../state/actions/pathNavigator';
import { getEditorMode, isEditableViaFormEditor, isFolder, isImage, isNavigable, isPreviewable } from './utils';
import { StateStylingProps } from '../../models/UiConfig';
import { debounceTime } from 'rxjs/operators';
import PathNavigatorUI from './PathNavigatorUI';
import PathNavigatorSkeleton from './PathNavigatorSkeleton';
import GlobalState from '../../models/GlobalState';
import { SystemIconDescriptor } from '../SystemIcon';
import { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import { getNumOfMenuOptionsForItem, isPdfDocument, isVideo, lookupItemByPath } from '../../utils/content';
import { useSelection } from '../../hooks/useSelection';
import { useEnv } from '../../hooks/useEnv';
import { useItemsByPath } from '../../hooks/useItemsByPath';
import { useSubject } from '../../hooks/useSubject';
import { useSiteLocales } from '../../hooks/useSiteLocales';
import { useMount } from '../../hooks/useMount';
import { createComponentId, getSystemLink, pickShowContentFormAction } from '../../utils/system';
import { getStoredPathNavigator } from '../../utils/state';
import { useActiveSite } from '../../hooks/useActiveSite';
import { useActiveUser } from '../../hooks/useActiveUser';
import { GetChildrenOptions, PartialSxRecord } from '../../models';
import { pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { showItemMegaMenu } from '../../state/actions/dialogs';
import TranslationOrText from '../../models/TranslationOrText';
import usePossibleTranslation from '../../hooks/usePossibleTranslation';
import { useIntl } from 'react-intl';

interface Menu {
	path?: string;
	sections?: ContextMenuOption[][];
	anchorEl: Element;
	loaderItems?: number;
	emptyState?: {
		icon?: ElementType;
		message: string;
	};
}

export type PathNavigatorClassKey = 'root' | 'body' | 'searchRoot';

export interface PathNavigatorProps {
	id: string;
	label: TranslationOrText;
	rootPath: string;
	sortStrategy?: GetChildrenOptions['sortStrategy'];
	order?: GetChildrenOptions['order'];
	excludes?: string[];
	locale?: string;
	limit?: number;
	initialCollapsed?: boolean;
	icon?: SystemIconDescriptor;
	expandedIcon?: SystemIconDescriptor;
	collapsedIcon?: SystemIconDescriptor;
	container?: Partial<StateStylingProps>;
	classes?: Partial<Record<PathNavigatorClassKey, string>>;
	sxs?: PartialSxRecord<PathNavigatorClassKey>;
	onItemClicked?(item: ContentItem, event?: React.MouseEvent): void;
	computeActiveItems?: (items: ContentItem[]) => string[];
	createItemClickedHandler?: (
		defaultHandler: (item: ContentItem, event?: React.MouseEvent) => void
	) => (item: ContentItem) => void;
}

export interface PathNavigatorStateProps {
	id: string;
	rootPath: string;
	currentPath: string;
	localeCode: string;
	keyword: string;
	isSelectMode: boolean;
	hasClipboard: boolean;
	levelDescriptor: string;
	itemsInPath: string[];
	breadcrumb: string[];
	selectedItems: string[];
	total: number; // Number of items in the current path
	limit: number;
	offset: number;
	collapsed?: boolean;
	excludes?: string[];
	isFetching: boolean;
	error: any;
	isRootPathMissing: boolean;
	sortStrategy: GetChildrenOptions['sortStrategy'];
	order: GetChildrenOptions['order'];
	revertPath?: string;
	pathFetchRequestId?: number;
}

// @see https://github.com/craftercms/craftercms/issues/5360
// const menuOptions: Record<'refresh', ContextMenuOptionDescriptor> = {
//   refresh: {
//     id: 'refresh',
//     label: translations.refresh
//   }
// };

export function PathNavigator(props: PathNavigatorProps) {
	const { formatMessage } = useIntl();
	const translatedLabel = usePossibleTranslation(props.label) || formatMessage({ defaultMessage: '(No name)' });
	// region const { ... } = props;
	const {
		icon,
		expandedIcon,
		collapsedIcon,
		container,
		rootPath: path,
		id = path,
		limit = 10,
		locale,
		excludes,
		initialCollapsed = true,
		onItemClicked: onItemClickedProp,
		createItemClickedHandler = (defaultHandler) => defaultHandler,
		computeActiveItems,
		sortStrategy,
		order,
		sxs
	} = props;
	// endregion
	const state = useSelection((state) => state.pathNavigator)[id];
	const itemsByPath = useItemsByPath();
	const { id: siteId, uuid } = useActiveSite();
	const user = useActiveUser();
	const { authoringBase } = useEnv();
	const dispatch = useDispatch();
	const [widgetMenu, setWidgetMenu] = useState<Menu>({
		anchorEl: null,
		sections: [],
		emptyState: null
	});
	const [keyword, setKeyword] = useState('');
	const onSearch$ = useSubject<string>();
	const uiConfig = useSelection<GlobalState['uiConfig']>((state) => state.uiConfig);
	const siteLocales = useSiteLocales();

	useEffect(() => {
		// Adding uiConfig as means to stop navigator from trying to
		// initialize with previous state information when switching sites
		if (!state && uiConfig.currentSite === siteId) {
			const storedState = getStoredPathNavigator(uuid, user.username, id);
			if (storedState?.keyword) {
				setKeyword(storedState.keyword);
			}
			dispatch(
				pathNavigatorInit({
					id,
					rootPath: path,
					locale,
					excludes,
					limit,
					collapsed: initialCollapsed,
					sortStrategy,
					order,
					...storedState
				})
			);
		}
	}, [
		dispatch,
		excludes,
		id,
		limit,
		locale,
		path,
		siteId,
		state,
		initialCollapsed,
		uiConfig.currentSite,
		user.username,
		uuid,
		sortStrategy,
		order
	]);

	useMount(() => {
		if (state) {
			dispatch(pathNavigatorBackgroundRefresh({ id }));
		}
	});

	useEffect(() => {
		const subscription = onSearch$.pipe(debounceTime(400)).subscribe((keyword) => {
			dispatch(pathNavigatorSetKeyword({ id, keyword }));
		});
		return () => {
			subscription.unsubscribe();
		};
	}, [dispatch, id, onSearch$]);

	useEffect(() => {
		if (siteLocales.defaultLocaleCode && state?.localeCode !== siteLocales.defaultLocaleCode) {
			dispatch(
				pathNavigatorSetLocaleCode({
					id,
					locale: siteLocales.defaultLocaleCode
				})
			);
		}
	}, [dispatch, id, siteLocales.defaultLocaleCode, state?.localeCode]);

	if (!state) {
		const storedState = getStoredPathNavigator(uuid, user.username, id);
		return <PathNavigatorSkeleton renderBody={storedState ? !storedState.collapsed : !initialCollapsed} />;
	}

	const onPathSelected = (item: ContentItem) => {
		dispatch(
			pathNavigatorFetchPath({
				id,
				path: item.path,
				keyword
			})
		);
	};

	const onPreview = (item: ContentItem) => {
		if (isEditableViaFormEditor(item)) {
			dispatch(pickShowContentFormAction({ path: item.path, authoringBase, site: siteId, readonly: true }));
		} else if (isImage(item) || isVideo(item) || isPdfDocument(item.mimeType)) {
			dispatch(
				pushDialog({
					component: createComponentId('PreviewDialog'),
					allowMinimize: true,
					allowFullScreen: true,
					props: {
						type: isImage(item) ? 'image' : isVideo(item) ? 'video' : 'pdf',
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

	const onPageChanged = (page: number) => {
		const offset = page * state.limit;
		dispatch(
			pathNavigatorChangePage({
				id,
				offset
			})
		);
	};

	const onRowsPerPageChange = (e: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
		const limit = Number(e.target.value);
		dispatch(
			pathNavigatorChangeLimit({
				id,
				limit,
				offset: 0
			})
		);
	};

	const onSelectItem = (item: ContentItem, checked: boolean) => {
		dispatch(
			checked
				? pathNavigatorItemChecked({ id, item })
				: pathNavigatorItemUnchecked({
						id,
						item
					})
		);
	};

	const onCurrentParentMenu = (element: Element) => {
		const anchorRect = element.getBoundingClientRect();
		const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
		const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');
		let path = state.currentPath;
		if (path === '/site/website') {
			path = withIndex(state.currentPath);
		}
		dispatch(
			showItemMegaMenu({
				path: path,
				anchorReference: 'anchorPosition',
				anchorPosition: { top, left },
				loaderItems: getNumOfMenuOptionsForItem(lookupItemByPath(path, itemsByPath))
			})
		);
	};

	const onOpenItemMenu = (element: Element, item: ContentItem) => {
		const anchorRect = element.getBoundingClientRect();
		const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
		const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');

		dispatch(
			showItemMegaMenu({
				path: item.path,
				anchorReference: 'anchorPosition',
				anchorPosition: { top, left },
				loaderItems: getNumOfMenuOptionsForItem(item)
			})
		);
	};

	const onHeaderButtonClick = (anchorEl: Element, type: string) => {
		// @see https://github.com/craftercms/craftercms/issues/5360
		onSimpleMenuClick('refresh');
		// setWidgetMenu({
		//   sections: [[toContextMenuOptionsLookup(menuOptions, formatMessage).refresh]],
		//   anchorEl
		// });
	};

	const onCloseWidgetMenu = () => setWidgetMenu({ ...widgetMenu, anchorEl: null });

	const onItemClicked = onItemClickedProp
		? onItemClickedProp
		: createItemClickedHandler((item: ContentItem, e) => {
				if (isNavigable(item)) {
					const url = getSystemLink({
						site: siteId,
						systemLinkId: 'preview',
						authoringBase,
						page: item.previewUrl
					});
					if (e.ctrlKey || e.metaKey) {
						window.open(url);
					} else {
						window.location.href = url;
					}
				} else if (isFolder(item)) {
					onPathSelected(item);
				} else if (isPreviewable(item)) {
					onPreview?.(item);
				}
			});

	const onBreadcrumbSelected = (item: ContentItem) => {
		if (withoutIndex(item.path) !== withoutIndex(state.currentPath)) {
			dispatch(pathNavigatorConditionallySetPath({ id, path: item.path, keyword }));
		}
	};

	const onSimpleMenuClick = (option: string) => {
		onCloseWidgetMenu();
		if (option === 'refresh') {
			dispatch(
				pathNavigatorRefresh({
					id
				})
			);
		}
	};

	const onChangeCollapsed = (collapsed: boolean) => {
		dispatch(pathNavigatorSetCollapsed({ id, collapsed }));
	};

	const onSearch = (keyword: string) => {
		setKeyword(keyword);
		onSearch$.next(keyword);
	};

	return (
		<>
			<PathNavigatorUI
				state={state}
				classes={props.classes}
				sxs={sxs}
				itemsByPath={itemsByPath}
				icon={expandedIcon && collapsedIcon ? (state.collapsed ? collapsedIcon : expandedIcon) : icon}
				container={container}
				title={translatedLabel}
				onChangeCollapsed={onChangeCollapsed}
				onHeaderButtonClick={state.collapsed ? void 0 : onHeaderButtonClick}
				onCurrentParentMenu={onCurrentParentMenu}
				siteLocales={siteLocales}
				keyword={keyword}
				onSearch={onSearch}
				onBreadcrumbSelected={onBreadcrumbSelected}
				onSelectItem={onSelectItem}
				onPathSelected={onPathSelected}
				onPreview={onPreview}
				onOpenItemMenu={onOpenItemMenu}
				onItemClicked={onItemClicked}
				onPageChanged={onPageChanged}
				onRowsPerPageChange={onRowsPerPageChange}
				computeActiveItems={computeActiveItems}
			/>
			<ContextMenu
				anchorEl={widgetMenu.anchorEl}
				options={widgetMenu.sections}
				emptyState={widgetMenu.emptyState}
				open={Boolean(widgetMenu.anchorEl)}
				onClose={onCloseWidgetMenu}
				onMenuItemClicked={onSimpleMenuClick}
			/>
		</>
	);
}

export default PathNavigator;
