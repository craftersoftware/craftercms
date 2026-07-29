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
import React, { useEffect, useId } from 'react';
import useActiveSite from '../../hooks/useActiveSite';
import { PathNavigatorTree } from '../PathNavigatorTree';
import { removeStoredPathNavigatorTree } from '../../utils/state';
import useActiveUser from '../../hooks/useActiveUser';
import { useDispatch } from 'react-redux';
import { pathNavigatorTreeExpandPath, pathNavigatorTreeFetchPathChildren } from '../../state/actions/pathNavigatorTree';
import { getIndividualPaths, withIndex } from '../../utils/path';
import { useItemsByPath } from '../../hooks/useItemsByPath';
import { lookupItemByPath } from '../../utils/content';
import { ContentItem } from '../../models/Item';
import { forkJoin, of } from 'rxjs';
import { batchActions } from '../../state/actions/misc';
import useSelection from '../../hooks/useSelection';
import useUpdateRefs from '../../hooks/useUpdateRefs';
import { useIntl } from 'react-intl';

export interface FolderBrowserTreeViewProps {
	rootPath: string;
	selectedPath: string;
	onPathSelected(path: string, item?: ContentItem): void;
}

export function FolderBrowserTreeView(props: FolderBrowserTreeViewProps) {
	const { rootPath, selectedPath, onPathSelected } = props;
	const { formatMessage } = useIntl();
	const id = useId();
	const tree = useSelection((state) => state.pathNavigatorTree[id]);
	const { uuid, id: siteId } = useActiveSite();
	const { username } = useActiveUser();
	const dispatch = useDispatch();
	const itemsByPath = useItemsByPath();
	const selectedPathWithIndex = withIndex(selectedPath);
	const refs = useUpdateRefs({ tree });
	useEffect(() => {
		if (
			// Simply checking that the tree has been initialized. Not using the very root object to
			// avoid changes on its state to trigger this effect unnecessarily.
			tree?.id === id
		) {
			const path = selectedPath || rootPath;
			// If it's `/site/website/*`, there's possibility of `index.xml` behaviours
			if (path.startsWith('/site/website')) {
				const paths = getIndividualPaths(path, rootPath);
				forkJoin(
					paths.map((p) => {
						const withIndexXml = withIndex(p);
						return withIndexXml in refs.current.tree.childrenByParentPath || p in refs.current.tree.childrenByParentPath
							? of(
									pathNavigatorTreeExpandPath({
										id,
										path: withIndexXml in refs.current.tree.childrenByParentPath ? withIndexXml : p
									})
								)
							: of(pathNavigatorTreeFetchPathChildren({ id, path: p, expand: true }));
					})
				).subscribe((actions) => {
					dispatch(actions.length === 1 ? actions[0] : batchActions(actions));
				});
			} else {
				const actions = getIndividualPaths(path, rootPath).map((p) =>
					p in refs.current.tree.childrenByParentPath
						? pathNavigatorTreeExpandPath({ id, path: p })
						: pathNavigatorTreeFetchPathChildren({ id, path: p, expand: true })
				);
				actions.length && dispatch(actions.length === 1 ? actions[0] : batchActions(actions));
			}
		}
	}, [refs, dispatch, id, rootPath, selectedPath, siteId, tree?.id]);
	useEffect(() => {
		return () => {
			removeStoredPathNavigatorTree(uuid, username, id);
		};
	}, [id, uuid, username]);
	return (
		<PathNavigatorTree
			id={id}
			label={formatMessage({ id: 'words.path', defaultMessage: 'Path' })}
			rootPath={rootPath}
			collapsible={false}
			initialCollapsed={false}
			initialSystemTypes={['folder', 'page']}
			active={{ [selectedPathWithIndex in (tree?.totalByPath ?? {}) ? selectedPathWithIndex : selectedPath]: true }}
			onNodeClick={(e, path) => onPathSelected?.(path, lookupItemByPath(path, itemsByPath))}
			sxs={{
				header: { '.MuiTypography-root': { fontWeight: 'bold' } }
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
