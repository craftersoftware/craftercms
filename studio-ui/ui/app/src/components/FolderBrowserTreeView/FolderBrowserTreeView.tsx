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

// @ts-ignore - React typings haven't been updated to include react 18 hooks
import React, { useCallback, useEffect, useId } from 'react';
import useActiveSite from '../../hooks/useActiveSite';
import { PathNavigatorTree } from '../PathNavigatorTree';
import { removeStoredPathNavigatorTree } from '../../utils/state';
import useActiveUser from '../../hooks/useActiveUser';
import { useDispatch } from 'react-redux';
import { pathNavigatorTreeExpandPath, pathNavigatorTreeFetchPathChildren } from '../../state/actions/pathNavigatorTree';
import { getIndividualPaths, withIndex } from '../../utils/path';
import { batchActions } from '../../state/actions/misc';
import useSelection from '../../hooks/useSelection';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { useIntl } from 'react-intl';

export interface FolderBrowserTreeViewProps {
	rootPath: string;
	selectedPath: string;
	highlightedPath?: string;
	onPathSelected(path: string): void;
}

export function FolderBrowserTreeView(props: FolderBrowserTreeViewProps) {
	const { rootPath, selectedPath, highlightedPath, onPathSelected } = props;
	const { formatMessage } = useIntl();
	const id = useId();
	const tree = useSelection((state) => state.pathNavigatorTree[id]);
	const { uuid, id: siteId } = useActiveSite();
	const { username } = useActiveUser();
	const dispatch = useDispatch();
	const selectedPathWithIndex = withIndex(selectedPath);
	const refs = useUpdateRefs({ tree });
	useEffect(() => {
		if (
			// Simply checking that the tree has been initialized. Not using the very root object to
			// avoid changes on its state to trigger this effect unnecessarily.
			tree?.id === id
		) {
			const chunk = refs.current.tree;
			const path = selectedPath || rootPath;
			const actions = path.startsWith('/site/website')
				? getIndividualPaths(path, rootPath).map((p) => {
						const withIndexXml = withIndex(p);
						return withIndexXml in chunk.childrenByParentPath || p in chunk.childrenByParentPath
							? pathNavigatorTreeExpandPath({
									id,
									path: withIndexXml in chunk.childrenByParentPath ? withIndexXml : p
								})
							: pathNavigatorTreeFetchPathChildren({ id, path: p, expand: true });
					})
				: getIndividualPaths(path, rootPath).map((p) =>
						p in chunk.childrenByParentPath
							? pathNavigatorTreeExpandPath({ id, path: p })
							: pathNavigatorTreeFetchPathChildren({ id, path: p, expand: true })
					);
			actions.length && dispatch(actions.length === 1 ? actions[0] : batchActions(actions));
		}
	}, [refs, dispatch, id, rootPath, selectedPath, siteId, tree?.id]);
	useEffect(() => {
		return () => {
			removeStoredPathNavigatorTree(uuid, username, id);
		};
	}, [id, uuid, username]);

	const handleNodeClick = useCallback(
		(event: React.MouseEvent, path: string) => {
			onPathSelected?.(path);
			if (tree?.id !== id) {
				return;
			}
			const withIndexXml = withIndex(path);
			if (tree.expanded.includes(path) || tree.expanded.includes(withIndexXml)) {
				return;
			}
			const childCount = tree.totalByPath[path] ?? tree.totalByPath[withIndexXml] ?? 0;
			if (childCount <= 0) {
				return;
			}
			const childrenLoaded = path in tree.childrenByParentPath || withIndexXml in tree.childrenByParentPath;
			dispatch(
				childrenLoaded
					? pathNavigatorTreeExpandPath({
							id,
							path: withIndexXml in tree.childrenByParentPath ? withIndexXml : path
						})
					: pathNavigatorTreeFetchPathChildren({ id, path, expand: true })
			);
		},
		[dispatch, id, onPathSelected, tree]
	);

	return (
		<PathNavigatorTree
			id={id}
			label={formatMessage({ id: 'words.path', defaultMessage: 'Path' })}
			rootPath={rootPath}
			collapsible={false}
			initialCollapsed={false}
			initialSystemTypes={['folder', 'page']}
			active={{ [selectedPathWithIndex in (tree?.totalByPath ?? {}) ? selectedPathWithIndex : selectedPath]: true }}
			onNodeClick={handleNodeClick}
			sxs={{
				header: { '.MuiTypography-root': { fontWeight: 'bold' } },
				activeItem:
					selectedPath === highlightedPath
						? { boxShadow: (theme) => `0px 0px 2px 2px ${theme.palette.primary.main}`, borderRadius: '2px' }
						: {}
			}}
			showNavigableAsLinks={false}
			showPublishingTarget={false}
			showWorkflowState={false}
			showItemMenu={false}
			limit={30}
		/>
	);
}

export default FolderBrowserTreeView;
