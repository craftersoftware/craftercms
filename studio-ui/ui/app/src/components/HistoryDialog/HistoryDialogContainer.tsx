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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useDispatch } from 'react-redux';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { useSpreadState } from '../../hooks/useSpreadState';
import { HistoryDialogContainerProps, Menu, menuInitialState, menuOptions } from './utils';
import { ItemHistoryEntry } from '../../models/Version';
import ContextMenu, { ContextMenuOption } from '../ContextMenu';
import {
	fetchContentVersion,
	historyDialogUpdate,
	showCompareVersionsDialog,
	showErrorDialog,
	showPreviewDialog,
	showViewVersionDialog
} from '../../state/actions/dialogs';
import translations from './translations';
import { batchActions } from '../../state/actions/misc';
import { fetchContentTypes } from '../../state/actions/preview';
import { fetchContentByCommitId } from '../../services/content';
import { getEditorMode, isImage, isPreviewable } from '../PathNavigator/utils';
import {
	compareBothVersions,
	compareToPreviousVersion,
	fetchItemVersions,
	revertContent,
	revertToPreviousVersion,
	versionsChangeItem,
	versionsChangeLimit,
	versionsChangePage
} from '../../state/actions/versions';
import { asDayMonthDateTime } from '../../utils/datetime';
import DialogBody from '../DialogBody/DialogBody';
import SingleItemSelector from '../SingleItemSelector';
import VersionList from '../VersionList';
import DialogFooter from '../DialogFooter/DialogFooter';
import { HistoryDialogPagination } from './HistoryDialogPagination';
import useSelection from '../../hooks/useSelection';
import useFetchContentItems from '../../hooks/useFetchContentItems';
import { ErrorBoundary } from '../ErrorBoundary';
import { LoadingState } from '../LoadingState';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { contentEvent } from '../../state/actions/system';
import { getHostToHostBus } from '../../utils/subjects';
import { filter } from 'rxjs/operators';
import { getRootPath } from '../../utils/path';
import { isComparableAsset, isPdfDocument, isVideo } from '../../utils/content';
import { nanoid } from 'nanoid';
import { pushConfirmDialog } from '../../utils/system';
import { popDialog } from '../../state/actions/dialogStack';
import { checkAndCancelAffectedPackages } from '../ViewPackagesDialog/utils';

export function HistoryDialogContainer(props: HistoryDialogContainerProps) {
	const { versionsBranch, error } = props;
	const { count, page, limit, current, rootPath, isConfig } = versionsBranch;
	useFetchContentItems([versionsBranch.item.path]);
	// TODO: It'd be best for the dialog to directly receive a live item. Must change versions branch to only hold the path.
	const item = useSelection((state) => state.content.itemsByPath[versionsBranch.item.path]);
	const path = item?.path ?? '';
	const [openSelector, setOpenSelector] = useState(false);
	const { formatMessage } = useIntl();
	const dispatch = useDispatch();
	const site = useActiveSiteId();
	const timeoutRef = useRef(null);
	const isItemPreviewable = isPreviewable(item);
	// Item may be null for config items in config management.
	const isDiffSupported = ['page', 'component', 'taxonomy'].includes(item?.systemType) || isComparableAsset(item);
	const [compareMode, setCompareMode] = useState<boolean>(false);
	const [selectedCompareVersions, setSelectedCompareVersions] = useState<string[]>([]);
	const [menu, setMenu] = useSpreadState<Menu>(menuInitialState);

	const handleOpenMenu = useCallback(
		(anchorEl, version, isCurrent = false, initialCommit) => {
			const hasOptions = ['page', 'component', 'taxonomy', 'asset'].includes(item.systemType);
			const contextMenuOptions: { [prop in keyof typeof menuOptions]: ContextMenuOption } = {};
			Object.entries(menuOptions).forEach(([key, value]) => {
				contextMenuOptions[key] = {
					id: value.id,
					label: formatMessage(value.label, value.values),
					icon: value.id === 'compareToPrevious' ? { id: '@mui/icons-material/ArrowDownwardRounded' } : null
				};
			});
			const sections: ContextMenuOption[][] = [];
			if (isItemPreviewable) {
				sections.push([contextMenuOptions.view]);
			}
			if (count > 1) {
				if (hasOptions) {
					if (initialCommit) {
						sections.push([contextMenuOptions.compareTo, contextMenuOptions.compareToCurrent]);
					} else if (isCurrent) {
						sections.push([contextMenuOptions.compareTo, contextMenuOptions.compareToPrevious]);
					} else {
						sections.push([
							contextMenuOptions.compareTo,
							contextMenuOptions.compareToCurrent,
							contextMenuOptions.compareToPrevious
						]);
					}
				}
				if (!item.stateMap.locked && (item.availableActionsMap.revert || isConfig) && version.revertible) {
					sections.push([isCurrent ? contextMenuOptions.revertToPrevious : contextMenuOptions.revertToThisVersion]);
				}
			}
			setMenu({
				sections,
				anchorEl,
				activeItem: version
			});
		},
		[
			item?.systemType,
			item?.availableActionsMap.revert,
			count,
			setMenu,
			formatMessage,
			isConfig,
			item?.stateMap.locked,
			isItemPreviewable
		]
	);
	const hasMenuOptions = isItemPreviewable || count > 1;

	useEffect(() => {
		if (error) {
			dispatch(showErrorDialog({ error }));
		}
	}, [error, dispatch]);

	const compareVersionDialogWithActions = () => {
		setCompareMode(false);
		setSelectedCompareVersions([]);
		return showCompareVersionsDialog({
			disableItemSwitching: true
		});
	};
	const handleViewItem = (version: ItemHistoryEntry) => {
		const versionPath = Boolean(version.path) && path !== version.path ? version.path : path;

		// If diff is supported, but the item is an asset, we don't show the ViewVersionDialog, instead we show the Preview dialog.
		if (isDiffSupported && item?.systemType !== 'asset') {
			dispatch(
				batchActions([
					fetchContentTypes(),
					fetchContentVersion({ path: versionPath, versionNumber: version.versionNumber }),
					showViewVersionDialog({})
				])
			);
		} else if (isItemPreviewable) {
			fetchContentByCommitId(site, versionPath, version.versionNumber).subscribe((content) => {
				const image = isImage(item);
				const video = isVideo(item);
				const pdf = isPdfDocument(item.mimeType);
				const isBinary = image || video || pdf;
				dispatch(
					showPreviewDialog({
						type: image ? 'image' : video ? 'video' : pdf ? 'pdf' : 'editor',
						title: item.label,
						...(isBinary ? { url: content } : { content, mode: getEditorMode(item) }),
						path: item.path,
						showEdit: current === version.versionNumber,
						subtitle: `v.${version.versionNumber}`,
						...(video ? { mimeType: item.mimeType } : {})
					})
				);
			});
		}
	};

	const compareBoth = (selected: string[]) => {
		const selectedADate = new Date(versionsBranch.byId[selected[0]].modifiedDate);
		const selectedBDate = new Date(versionsBranch.byId[selected[1]].modifiedDate);
		// When comparing versions, we want to show what the new version did to the old. For that, we check for the most
		// recent version and add it first in the list of versions to compare.
		dispatch(
			batchActions([
				fetchContentTypes(),
				compareBothVersions({
					versions: selectedADate > selectedBDate ? [selected[0], selected[1]] : [selected[1], selected[0]]
				}),
				compareVersionDialogWithActions()
			])
		);
	};

	const compareToPrevious = (versionNumber: string) => {
		dispatch(
			batchActions([
				fetchContentTypes(),
				compareToPreviousVersion({ id: versionNumber }),
				compareVersionDialogWithActions()
			])
		);
	};

	const confirmAndRevert = (versionTitle: string, onRevert: () => void) => {
		const dialogId = nanoid();
		dispatch(
			pushConfirmDialog({
				id: dialogId,
				props: {
					title: formatMessage(translations.confirmRevertTitle),
					body: formatMessage(translations.confirmRevertBody, { versionTitle }),
					onCancel: () => dispatch(popDialog({ id: dialogId })),
					onOk: () => {
						dispatch(popDialog({ id: dialogId }));
						if (!item) {
							onRevert();
							return;
						}
						checkAndCancelAffectedPackages({
							siteId: site,
							item,
							dispatch,
							formatMessage,
							cancelPackagesComment: formatMessage(
								{ defaultMessage: 'Cancel packages to revert "{path}"' },
								{ path: item.path }
							),
							subtitle: (
								<FormattedMessage defaultMessage="The item is part of one or more publishing packages. Reverting it will cancel the packages." />
							),
							onContinue: onRevert
						});
					}
				}
			})
		);
	};

	const revertToPrevious = (activeItem: ItemHistoryEntry) => {
		const previousBranch = getPreviousBranch(activeItem);
		confirmAndRevert(asDayMonthDateTime(previousBranch.modifiedDate), () =>
			dispatch(revertToPreviousVersion({ path, id: activeItem.versionNumber, siteId: site }))
		);
	};

	const getPreviousBranch = (currentBranch: ItemHistoryEntry) => {
		const versions = versionsBranch.versions;
		const currentIndex = versions.findIndex((branch) => branch.versionNumber === currentBranch.versionNumber);
		return versions[currentIndex + 1] ?? null;
	};

	const revertTo = (activeItem: ItemHistoryEntry) => {
		confirmAndRevert(asDayMonthDateTime(activeItem.modifiedDate), () =>
			dispatch(revertContent({ path, versionNumber: activeItem.versionNumber, siteId: site }))
		);
	};

	const handleContextMenuClose = () => {
		setMenu({
			anchorEl: null,
			activeItem: null
		});
	};

	const handleContextMenuItemClicked = (option: string) => {
		const activeItem = menu.activeItem;
		setMenu(menuInitialState);
		switch (option) {
			case 'view': {
				handleViewItem(activeItem);
				break;
			}
			case 'compareTo': {
				setCompareMode(true);
				onVersionSelected(activeItem);
				break;
			}
			case 'compareToCurrent': {
				compareBoth([current, activeItem.versionNumber]);
				break;
			}
			case 'compareToPrevious': {
				compareToPrevious(activeItem.versionNumber);
				break;
			}
			case 'revertToPrevious': {
				revertToPrevious(activeItem);
				break;
			}
			case 'revertToThisVersion': {
				revertTo(activeItem);
				break;
			}
			default:
				break;
		}
	};

	// A user clicking too eagerly to jump to a much later page may end up clicking
	// the backdrop by mistake when the number of versions goes from pushing the height
	// of the dialog away from its minimum and then on the next page back to the minimum.
	// The timeout gives the user a chance to catch up with the change in the position of
	// the pagination button and/or realise he's reached the last page without closing the
	// dialog unintentionally.
	const temporaryBackdropClickDisable = () => {
		clearTimeout(timeoutRef.current);
		dispatch(historyDialogUpdate({ hasPendingChanges: true }));
		timeoutRef.current = setTimeout(() => dispatch(historyDialogUpdate({ hasPendingChanges: false })), 700);
	};

	const onPageChanged = (nextPage: number) => {
		temporaryBackdropClickDisable();
		dispatch(versionsChangePage({ page: nextPage }));
	};

	const onRowsPerPageChange = (limit: number) => {
		temporaryBackdropClickDisable();
		dispatch(versionsChangeLimit({ limit }));
	};

	const onVersionSelected = (version: ItemHistoryEntry) => {
		const newSelectedVersions = selectedCompareVersions.includes(version.versionNumber)
			? selectedCompareVersions.filter((v) => v !== version.versionNumber)
			: [...selectedCompareVersions, version.versionNumber];

		if (newSelectedVersions.length === 2) {
			compareBoth(newSelectedVersions);
		} else {
			setSelectedCompareVersions(newSelectedVersions);
		}
	};

	// region Item Updates Propagation
	useEffect(() => {
		const events = [contentEvent.type];
		const hostToHost$ = getHostToHostBus();
		const subscription = hostToHost$
			.pipe(filter((e) => events.includes(e.type) && e.payload.targetPath === item.path))
			.subscribe(() => {
				dispatch(
					fetchItemVersions({
						item,
						rootPath: getRootPath(item.path)
					})
				);
			});
		return () => {
			subscription.unsubscribe();
		};
	}, [dispatch, item]);
	// endregion

	return (
		<>
			<DialogBody sx={{ overflow: 'auto', minHeight: '50vh' }} minHeight>
				<Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
					<SingleItemSelector
						label={<FormattedMessage id="words.item" defaultMessage="Item" />}
						open={openSelector}
						disabled={isConfig}
						onClose={() => setOpenSelector(false)}
						onDropdownClick={() => setOpenSelector(!openSelector)}
						rootPath={rootPath}
						selectedItem={item}
						onItemClicked={(item) => {
							setOpenSelector(false);
							dispatch(versionsChangeItem({ item }));
							setSelectedCompareVersions([]);
							setCompareMode(false);
						}}
					/>
					{isDiffSupported && count > 1 && (
						<FormControlLabel
							control={<Switch color="primary" checked={compareMode} />}
							label={<FormattedMessage defaultMessage="Compare" />}
							labelPlacement="start"
							disabled={versionsBranch.versions?.length <= 1}
							onChange={(e) => {
								setCompareMode((e.currentTarget as HTMLInputElement).checked);
							}}
						/>
					)}
				</Box>
				<ErrorBoundary>
					{versionsBranch.isFetching ? (
						<LoadingState />
					) : (
						versionsBranch.versions && (
							<VersionList
								versions={versionsBranch.versions}
								onOpenMenu={hasMenuOptions && !compareMode ? handleOpenMenu : null}
								onItemClick={compareMode ? (version) => onVersionSelected(version) : handleViewItem}
								selected={selectedCompareVersions}
								current={current}
								isSelectMode={compareMode}
							/>
						)
					)}
				</ErrorBoundary>
			</DialogBody>
			<DialogFooter sx={{ p: 0 }}>
				{count > 0 && (
					<HistoryDialogPagination
						count={count}
						page={page}
						rowsPerPage={limit}
						onPageChanged={onPageChanged}
						onRowsPerPageChange={onRowsPerPageChange}
					/>
				)}
			</DialogFooter>
			{Boolean(menu.anchorEl) && (
				<ContextMenu
					open
					anchorEl={menu.anchorEl}
					onClose={handleContextMenuClose}
					options={menu.sections}
					onMenuItemClicked={handleContextMenuItemClicked}
				/>
			)}
		</>
	);
}
