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
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightIcon from '@mui/icons-material/ChevronRightRounded';
import MoreVertIcon from '@mui/icons-material/MoreVertRounded';
import { TreeItem, treeItemClasses } from '@mui/x-tree-view/TreeItem';
import MuiBreadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import { ContentType, ContentTypeField } from '../../models/ContentType';
import Page from '../../icons/Page';
import ContentTypeFieldIcon from '../../icons/ContentTypeField';
import Component from '../../icons/Component';
import NodeSelector from '../../icons/NodeSelector';
import RepeatGroupItem from '../../icons/RepeatGroupItem';
import Root from '@mui/icons-material/HomeRounded';
import NavigateNextIcon from '@mui/icons-material/NavigateNextRounded';
import { LookupTable } from '../../models/LookupTable';
import ContentInstance from '../../models/ContentInstance';
import RepeatGroup from '../../icons/RepeatGroup';
import { hierarchicalToLookupTable } from '../../utils/object';
import {
	clearContentTreeFieldSelected,
	contentTreeFieldSelected,
	deleteItemOperationComplete,
	sortItemOperationComplete
} from '../../state/actions/preview';
import { getHostToGuestBus, getHostToHostBus } from '../../utils/subjects';
import palette from '../../styles/palette';
import { useDispatch } from 'react-redux';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import ItemActionsMenu from '../ItemActionsMenu';
import SearchBar from '../SearchBar/SearchBar';
import Divider from '@mui/material/Divider';
import { getOffsetLeft, getOffsetTop } from '@mui/material/Popover';
import { useSelection } from '../../hooks/useSelection';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { usePreviewGuest } from '../../hooks/usePreviewGuest';
import { useUnmount } from '../../hooks/useUnmount';
import { useSpreadState } from '../../hooks/useSpreadState';
import { SimpleTreeView } from '@mui/x-tree-view';
import { LoadingState } from '../LoadingState';
import { svgIconClasses, typographyClasses } from '@mui/material';
import Box from '@mui/material/Box';
import { showItemMegaMenu } from '../../state/actions/dialogs';

const rootPrefix = '{root}_';

const translations = defineMessages({
	title: {
		id: 'previewPageExplorerPanel.title',
		defaultMessage: 'Page Explorer'
	},
	loading: {
		id: 'previewPageExplorerPanel.loading',
		defaultMessage: 'Loading'
	},
	onThisPage: {
		id: 'previewPageExplorerPanel.rootItemLabel',
		defaultMessage: 'Current Content Items'
	}
});

export interface RenderTree {
	id: string;
	name: string;
	children: string[];
	type: string;
	modelId?: string;
	parentId?: string;
	path?: string;
	embeddedParentPath?: string;
	fieldId?: string;
	index?: string | number;
}

function getNodeSelectorChildren(
	model: ContentInstance,
	parentModelId: string,
	path: string,
	itemContentTypeName: string,
	fieldId: string,
	index: number | string
) {
	return {
		id: `${parentModelId}_${fieldId}_${index}`,
		name: `${itemContentTypeName}: ${model.craftercms.label}`,
		type: 'component',
		modelId: `${model.craftercms.id}`,
		parentId: parentModelId,
		embeddedParentPath: path || null,
		fieldId,
		index
	};
}

function getRepeatGroupChildren(
	item: LookupTable<any>,
	contentTypeField: ContentTypeField,
	contentTypes: LookupTable<ContentType>,
	parentTreeItemId: string,
	model: ContentInstance,
	models: LookupTable<ContentInstance>,
	index: number
) {
	let children = [];
	Object.keys(item).forEach((fieldName) => {
		let subChildren = [];
		let fieldId = fieldName;
		if (contentTypeField) return;
		const { type, name } = contentTypeField.fields[fieldName];
		if (type === 'node-selector') {
			fieldId = `${contentTypeField.id}.${fieldName}`;
			item[fieldName].forEach((id: string, i: number) => {
				let itemContentTypeName = contentTypes[models[id].craftercms.contentTypeId].name;
				subChildren.push(
					getNodeSelectorChildren(
						models[id],
						model.craftercms.id,
						models[id].craftercms.path ? null : model.craftercms.path,
						itemContentTypeName,
						fieldId,
						`${index}.${i}`
					)
				);
			});
		}
		children.push({
			id: `${parentTreeItemId}_${fieldName}`,
			name,
			type,
			children: subChildren,
			modelId: model.craftercms.id,
			fieldId,
			index
		});
	});
	return children;
}

function getChildren(
	model: ContentInstance,
	contentType: ContentType,
	models: LookupTable<ContentInstance>,
	contentTypes: LookupTable<ContentType>
) {
	let children = [];
	Object.keys(model).forEach((fieldName) => {
		if (fieldName === 'craftercms') return;
		const contentTypeField = getContentTypeField(contentType, fieldName, contentTypes);
		if (!contentTypeField) return;
		const { type, name } = contentTypeField;
		let subChildren = [];
		if (type === 'node-selector') {
			model[fieldName].forEach((id: string, i: number) => {
				let itemContentTypeName = contentTypes[models[id].craftercms.contentTypeId].name;
				subChildren.push(
					getNodeSelectorChildren(
						models[id],
						model.craftercms.id,
						models[id].craftercms.path ? null : model.craftercms.path,
						itemContentTypeName,
						fieldName,
						i
					)
				);
			});
		} else if (type === 'repeat') {
			model[fieldName].forEach((item, index: number) => {
				let id = `${model.craftercms.id}_${fieldName}_${index}`;
				subChildren.push({
					id,
					name: `Item ${index + 1}`,
					type: 'item',
					children: getRepeatGroupChildren(
						item,
						getContentTypeField(contentType, fieldName, contentTypes),
						contentTypes,
						id,
						model,
						models,
						index
					),
					modelId: model.craftercms.id,
					fieldId: `${fieldName}`,
					index
				});
			});
		}
		children.push({
			id: `${model.craftercms.id}_${fieldName}`,
			name,
			type,
			children: subChildren,
			modelId: model.craftercms.id,
			path: model.craftercms.path,
			fieldId: fieldName
		});
	});
	return children;
}

function getContentTypeField(
	contentType: ContentType,
	fieldName: string,
	contentTypes: LookupTable<ContentType>
): ContentTypeField {
	return contentType.fields[fieldName] ?? contentTypes['/component/level-descriptor'].fields[fieldName] ?? null;
}

interface TreeItemCustomInterface {
	nodeLookup: LookupTable<RenderTree>;
	node: RenderTree;
	isRootChild?: boolean;
	keyword?: string;

	handleScroll?(node: RenderTree): void;

	handleClick?(node: RenderTree): void;

	handleOptions?(e: any, node: RenderTree): void;
}

function TreeItemCustom(props: TreeItemCustomInterface) {
	const { nodeLookup, node, handleScroll, handleClick, handleOptions, isRootChild, keyword } = props;
	const [over, setOver] = useState(false);
	let timeout = React.useRef<any>(undefined);
	const isMounted = useRef(null);
	let Icon;
	const nodeName = node.name.split(':');

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	if (!node) {
		return null;
	} else {
		if (node.type === 'page') {
			Icon = Page;
		} else if (node.type === 'node-selector') {
			Icon = NodeSelector;
		} else if (node.type === 'component') {
			Icon = Component;
		} else if (node.type === 'repeat') {
			Icon = RepeatGroup;
		} else if (node.type === 'item') {
			Icon = RepeatGroupItem;
		} else if (node.type === 'root') {
			Icon = Root;
		} else {
			Icon = ContentTypeFieldIcon;
		}
	}

	function setOverState(e: React.MouseEvent, isOver: boolean) {
		e.stopPropagation();
		clearTimeout(timeout.current);
		if (!isOver) {
			timeout.current = setTimeout(() => {
				isMounted.current && setOver(false);
			}, 50);
		} else {
			isMounted.current && setOver(isOver);
		}
	}

	function isRoot(id) {
		return id.includes('root') || node.id.includes(rootPrefix);
	}

	function isPageOrComponent(type: string) {
		return node.type === 'component' || node.type === 'page';
	}

	const children = keyword
		? node.children?.filter((childNodeId) =>
				nodeLookup[String(childNodeId)].name.toLowerCase().includes(keyword.toLowerCase())
			)
		: node.children;

	return (
		<TreeItem
			key={node.id}
			itemId={node.id}
			onMouseOver={(e) => setOverState(e, true)}
			onMouseOut={(e) => setOverState(e, false)}
			slots={{
				icon: isPageOrComponent(node.type) && ChevronRightIcon
			}}
			slotProps={{
				icon: isPageOrComponent(node.type) && {
					onClick: () => handleClick(node)
				}
			}}
			label={
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						height: '36px',
						'& p': {
							marginTop: 0,
							marginLeft: '5px',
							marginRight: '5px',
							overflow: 'hidden',
							display: '-webkit-box',
							WebkitLineClamp: 1,
							WebkitBoxOrient: 'vertical',
							marginBottom: 0,
							wordBreak: 'break-all'
						}
					}}
					onClick={() => handleScroll(node)}
				>
					<Icon sx={{ color: palette.teal.main }} />
					<p title={node.name}>
						{nodeName.length === 1 ? (
							nodeName[0]
						) : (
							<>
								{nodeName[1]}{' '}
								<Box
									component="span"
									sx={{ color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium4) }}
								>{`(${nodeName[0].trim()})`}</Box>
							</>
						)}
					</p>
					{over && node.path && (
						<IconButton
							sx={{ marginLeft: 'auto', padding: '6px' }}
							onMouseOver={(e) => setOverState(e, true)}
							onClick={(e) => handleOptions(e, node)}
							size="large"
						>
							<MoreVertIcon />
						</IconButton>
					)}
				</Box>
			}
			classes={{
				content: [isPageOrComponent(node.type) && !isRootChild && 'padded', isRoot(node.id) && 'root']
					.filter(Boolean)
					.join(' ')
			}}
			sx={{
				[`& .${treeItemClasses.content}`]: {
					pt: 0,
					pb: 0,
					paddingLeft: '8px',
					'&.padded': {
						paddingLeft: '15px'
					},
					'&.root': {
						paddingLeft: 0
					}
				},
				'&:focus > .MuiTreeItem-content': {
					'& .MuiTreeItem-label': {
						backgroundColor: 'inherit'
					},
					'& .MuiTreeItem-label:hover': {
						backgroundColor: 'rgba(0, 0, 0, 0.04)'
					}
				},
				[`& .${treeItemClasses.iconContainer}`]: {
					[`& .${svgIconClasses.root}`]: {
						color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium3),
						fontSize: '1.4rem'
					}
				}
			}}
		>
			{children?.map((childNodeId, i) => (
				<TreeItemCustom
					{...props}
					key={String(childNodeId) + i}
					node={nodeLookup[String(childNodeId)]}
					isRootChild={node.type === 'root'}
				/>
			))}
		</TreeItem>
	);
}

export function PreviewPageExplorerPanel() {
	const dispatch = useDispatch();
	const guest = usePreviewGuest();
	const currentModelId = guest?.modelId;
	const { formatMessage } = useIntl();
	const contentTypesBranch = useSelection((state) => state.contentTypes);
	const hostToGuest$ = getHostToGuestBus();
	const hostToHost$ = getHostToHostBus();
	const site = useActiveSiteId();
	const [keyword, setKeyword] = useState('');
	const [optionsMenu, setOptionsMenu] = useState({
		modelId: null,
		anchorEl: null,
		path: null
	});

	const [state, setState] = React.useState<any>({
		selected: `root`,
		expanded: ['root'],
		breadcrumbs: ['root']
	});

	const [nodeLookup, setNodeLookup] = useSpreadState<any>({});

	const ContentTypesById = contentTypesBranch?.byId;
	const models = guest?.models;

	const processedModels = useRef({});

	const updateNode = useCallback(
		(modelId: string, fieldId: string, nodeId: string) => {
			const model = models[modelId];
			const children = [];

			// TODO: IF deleted op, optional: remove deleted id from nodeLookup

			if (nodeLookup[nodeId].type === 'node-selector') {
				model[fieldId].forEach((id: string, i: number) => {
					let itemContentTypeName = ContentTypesById[models[id].craftercms.contentTypeId].name;
					children.push(
						getNodeSelectorChildren(
							models[id],
							model.craftercms.id,
							models[id].craftercms.path ? null : model.craftercms.path,
							itemContentTypeName,
							fieldId,
							i
						)
					);
				});
				const updatedNode = {
					...nodeLookup[nodeId],
					children: children.map((node: RenderTree) => node.id)
				};
				setNodeLookup({ [nodeId]: updatedNode, ...hierarchicalToLookupTable(children) });
			} else if (nodeLookup[nodeId].type === 'page') {
				const contentType = ContentTypesById[model.craftercms.contentTypeId];
				const rootNode = {
					...nodeLookup[nodeId],
					children: getChildren(model, contentType, models, ContentTypesById)
				};

				setNodeLookup({ ...hierarchicalToLookupTable(rootNode) });
			}
		},
		[ContentTypesById, models, nodeLookup, setNodeLookup]
	);

	const updateRoot = useCallback(
		(modelId: string, fieldId: string, index: string | number, update: Function) => {
			processedModels.current = {};
			Object.values(models).forEach((model) => {
				processedModels.current[model.craftercms.id] = true;
			});
			update();
		},
		[models]
	);

	// effect to refresh the contentTree if the models are updated
	useEffect(() => {
		const sub = hostToHost$.subscribe((action) => {
			switch (action.type) {
				case deleteItemOperationComplete.type:
				case sortItemOperationComplete.type: {
					const { modelId, fieldId, index } = action.payload;
					if (state.expanded.includes(`${modelId}_${fieldId}`)) {
						updateNode(modelId, fieldId, `${modelId}_${fieldId}`);
					} else if (state.selected.includes(modelId)) {
						updateNode(modelId, fieldId, `${rootPrefix}${modelId}`);
					} else if (state.selected === 'root' && action.type === deleteItemOperationComplete.type) {
						updateRoot(modelId, fieldId, index, () => setState({ ...state }));
					}
				}
			}
		});

		return () => {
			sub.unsubscribe();
		};
	}, [dispatch, hostToHost$, state, updateNode, updateRoot]);

	// effect to refresh the contentTree if the site changes;
	useEffect(() => {
		if (site && currentModelId) {
			processedModels.current = {};
			setState({
				selected: `root`,
				expanded: ['root'],
				breadcrumbs: ['root']
			});
		}
	}, [site, currentModelId]);

	useEffect(() => {
		if (models && ContentTypesById) {
			let _nodeLookup = {};
			let shouldSetState = false;
			Object.values(models).forEach((model) => {
				let contentType = ContentTypesById[model.craftercms.contentTypeId];
				if (!processedModels.current[model.craftercms.id] && contentType) {
					processedModels.current[model.craftercms.id] = true;
					let node: RenderTree = {
						id: model.craftercms.id,
						name: `${contentType.name}: ${model.craftercms.label}`,
						children: [],
						type: contentType.type,
						path: model.craftercms.path,
						modelId: model.craftercms.id
					};
					shouldSetState = true;
					_nodeLookup[node.id] = node;
				}
			});
			if (shouldSetState) {
				setNodeLookup(_nodeLookup);
			}
		}
	}, [ContentTypesById, formatMessage, models, setNodeLookup]);

	useEffect(() => {
		const handler = (e) => {
			if (e.keyCode === 27) {
				hostToGuest$.next({ type: clearContentTreeFieldSelected.type });
			}
		};
		document.addEventListener('keydown', handler, false);
		return () => document.removeEventListener('keydown', handler, false);
	}, [dispatch, hostToGuest$]);

	const onBack = () => {
		hostToGuest$.next({ type: 'CLEAR_CONTENT_TREE_FIELD_SELECTED' });
	};

	const handleClick = (node: RenderTree) => {
		if ((node.type === 'component' || node.type === 'page') && !node.id.includes(rootPrefix)) {
			let model = models[node.modelId];
			let contentType = ContentTypesById[model.craftercms.contentTypeId];

			const rootNode = {
				...node,
				id: `${rootPrefix}${node.id}`,
				children: getChildren(model, contentType, models, ContentTypesById)
			};

			setNodeLookup({ ...hierarchicalToLookupTable(rootNode) });
			setKeyword('');
			setState({
				selected: node.id,
				expanded: [`${rootPrefix}${node.id}`],
				breadcrumbs: [...state.breadcrumbs, node.id]
			});
		}
	};

	const handleScroll = (node: RenderTree) => {
		hostToGuest$.next({
			type: contentTreeFieldSelected.type,
			payload: {
				name: node.name,
				modelId: node.parentId || node.modelId,
				fieldId: node.fieldId ?? null,
				index: node.index ?? null
			}
		});
		return;
	};

	const handleBreadCrumbClick = (event, node?: RenderTree) => {
		event.stopPropagation();
		if (!state.breadcrumbs.length) return null;
		let breadcrumbsArray = [...state.breadcrumbs];
		breadcrumbsArray = breadcrumbsArray.slice(0, breadcrumbsArray.indexOf(node.id) + 1);

		setState({
			...state,
			selected: node.id,
			expanded: node.id === 'root' ? [node.id] : [`${rootPrefix}${node.id}`],
			breadcrumbs: breadcrumbsArray
		});
	};

	const handleChange = (event: any, nodes: string[]) => {
		if (event.target.classList.contains('toggle') || event.target.parentElement.classList.contains('toggle')) {
			setState({ ...state, expanded: [...nodes] });
		}
	};

	const handleOptions = (event: any, node: RenderTree) => {
		event.stopPropagation();

		const path = node.path;
		const element = event.currentTarget;
		const anchorRect = element.getBoundingClientRect();
		const top = anchorRect.top + getOffsetTop(anchorRect, 'top');
		const left = anchorRect.left + getOffsetLeft(anchorRect, 'left');

		if (path) {
			dispatch(
				showItemMegaMenu({
					path: path,
					anchorReference: 'anchorPosition',
					anchorPosition: { top, left }
				})
			);
		}
	};

	const handleClose = () => setOptionsMenu({ ...optionsMenu, anchorEl: null });

	const handleSearchKeyword = (keyword) => {
		setKeyword(keyword);
	};

	useUnmount(onBack);

	return (
		<>
			<SimpleTreeView
				sx={{
					'& > li > ul': {
						marginLeft: '0'
					},
					[`& .${treeItemClasses.iconContainer}`]: {
						[`& .${svgIconClasses.root}`]: {
							color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium3),
							fontSize: '1.4rem'
						}
					}
				}}
				slots={{
					collapseIcon: ExpandMoreIcon,
					expandIcon: ChevronRightIcon
				}}
				slotProps={{
					collapseIcon: {
						className: 'toggle'
					},
					expandIcon: {
						className: 'toggle'
					}
				}}
				disableSelection
				expandedItems={state.expanded}
				onExpandedItemsChange={handleChange}
			>
				<Box sx={{ padding: '10px' }}>
					<SearchBar showActionButton={Boolean(keyword)} onChange={handleSearchKeyword} keyword={keyword} autoFocus />
					<Divider sx={{ marginTop: '10px' }} />
				</Box>
				{models && ContentTypesById ? (
					<PageExplorerUI
						handleBreadCrumbClick={handleBreadCrumbClick}
						handleClick={handleClick}
						handleClose={handleClose}
						handleScroll={handleScroll}
						optionsMenu={optionsMenu}
						rootPrefix={rootPrefix}
						handleOptions={handleOptions}
						keyword={keyword}
						nodeLookup={nodeLookup}
						selected={state.selected}
						breadcrumbs={state.breadcrumbs}
						rootChildren={Object.keys(processedModels.current)}
					/>
				) : (
					<LoadingState title={formatMessage(translations.loading)} />
				)}
			</SimpleTreeView>
		</>
	);
}

interface PageExplorerUIProps {
	optionsMenu: {
		modelId: string;
		anchorEl: Element;
		path: null;
	};
	rootPrefix: string;
	keyword: string;
	handleScroll(node: RenderTree): void;
	handleClick(node: RenderTree): void;
	handleClose(): void;
	handleOptions?(e: any, node: RenderTree): void;
	handleBreadCrumbClick(event, node?: RenderTree): void;
	nodeLookup: any;
	selected: any;
	breadcrumbs: any;
	rootChildren: string[];
}

function PageExplorerUI(props: PageExplorerUIProps) {
	const {
		handleScroll,
		handleClick,
		handleOptions,
		handleClose,
		handleBreadCrumbClick,
		optionsMenu,
		rootPrefix,
		nodeLookup,
		selected,
		keyword,
		breadcrumbs,
		rootChildren
	} = props;
	const { formatMessage } = useIntl();

	let node: any = null;

	if (selected === 'root') {
		node = {
			id: 'root',
			name: formatMessage(translations.onThisPage),
			children: rootChildren,
			type: 'root',
			modelId: 'root'
		};
	} else {
		node = nodeLookup[`${rootPrefix}${selected}`];
	}

	return (
		<>
			{Boolean(breadcrumbs.length > 1) && (
				<MuiBreadcrumbs
					maxItems={2}
					aria-label="Breadcrumbs"
					separator={<NavigateNextIcon fontSize="small" />}
					sx={{
						[`& .${breadcrumbsClasses.ol}`]: {
							display: 'flex',
							alignItems: 'center',
							padding: '9px 10px 2px 8px'
						},
						[`& .${breadcrumbsClasses.separator}`]: {
							margin: '0 2px'
						}
					}}
				>
					{breadcrumbs.map((id, i: number) =>
						id === selected ? (
							<Typography
								key={nodeLookup[id].id}
								variant="subtitle2"
								sx={{ color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium4) }}
								children={nodeLookup[id].name.split(':').pop()}
							/>
						) : (
							<Link
								key={id === 'root' ? 'root' : nodeLookup[id].id}
								color="inherit"
								component="button"
								variant="subtitle2"
								underline="always"
								sx={{
									display: 'flex',
									[`& .${typographyClasses.root}`]: {
										color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium4)
									}
								}}
								onClick={(e) => handleBreadCrumbClick(e, id === 'root' ? { id: 'root' } : nodeLookup[id])}
								children={
									id === 'root' ? (
										<Root
											sx={{
												fontSize: '1.2em',
												color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium7)
											}}
										/>
									) : (
										nodeLookup[id].name.split(':').pop()
									)
								}
							/>
						)
					)}
				</MuiBreadcrumbs>
			)}
			{node.id === 'root' ? (
				<>
					<Typography
						variant="subtitle1"
						sx={{
							fontWeight: 600,
							color: (theme) => (theme.palette.mode === 'dark' ? palette.white : palette.gray.medium7),
							padding: '0 12px 2px 12px'
						}}
					>
						<FormattedMessage id="pageExplorerPanel.currentContentItems" defaultMessage="Current Content Items" />
					</Typography>
					{node.children
						?.filter((childNodeId) =>
							nodeLookup[String(childNodeId)].name.toLowerCase().includes(keyword.toLowerCase())
						)
						.map((childNodeId, i) => (
							<TreeItemCustom
								{...props}
								key={String(childNodeId) + i}
								node={nodeLookup[String(childNodeId)]}
								isRootChild={node.type === 'root'}
							/>
						))}
				</>
			) : (
				<TreeItemCustom
					node={node}
					keyword={keyword}
					nodeLookup={nodeLookup}
					handleScroll={handleScroll}
					handleClick={handleClick}
					handleOptions={handleOptions}
				/>
			)}
			{Boolean(optionsMenu.anchorEl) && (
				<ItemActionsMenu
					path={optionsMenu.path}
					open={Boolean(optionsMenu.anchorEl)}
					anchorEl={optionsMenu.anchorEl}
					onClose={handleClose}
				/>
			)}
		</>
	);
}

export default PreviewPageExplorerPanel;
