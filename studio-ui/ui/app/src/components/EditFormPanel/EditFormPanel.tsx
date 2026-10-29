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

import React from 'react';
import ToolPanel from '../ToolPanel/ToolPanel';
import CloseRounded from '@mui/icons-material/CloseRounded';
import Typography from '@mui/material/Typography';
import { useDispatch } from 'react-redux';
import { defineMessages, useIntl } from 'react-intl';
import { nnou } from '../../utils/object';
import * as ModelHelper from '../../utils/model';
import { findParentModelId } from '../../utils/model';
import { popPiece } from '../../utils/string';
import { getField } from '../../utils/contentType';
import { Menu, MenuItem } from '@mui/material';
import { GuestData } from '../../models/GlobalState';
import { useSelection } from '../../hooks/useSelection';
import { useActiveSiteId } from '../../hooks/useActiveSiteId';
import { usePreviewState } from '../../hooks/usePreviewState';
import ContentInstance from '../../models/ContentInstance';
import { pushDialog } from '../../state/actions/dialogStack';
import { nanoid } from 'nanoid';
import { createComponentId, pickShowContentFormAction } from '../../utils/system';
import { popCodeEditorDialog } from '../../state/actions/dialogs';

interface EditFormPanelProps {
	open: boolean;
	onDismiss: () => void;
}

interface EditFormPanelBodyProps {
	onDismiss: () => void;
	selected: GuestData['selected'];
	models: GuestData['models'];
	hierarchyMap: GuestData['hierarchyMap'];
	modelIdByPath: GuestData['modelIdByPath'];
}

const getEditDialogProps = (props: {
	authoringBase: string;
	hierarchyMap: GuestData['hierarchyMap'];
	model: ContentInstance;
	models: GuestData['models'];
	path: string;
	selectedId: string;
	site: string;
	selectedFields: string[];
	index?: string | number;
}) => {
	const { authoringBase, hierarchyMap, model, models, path, selectedId, site, selectedFields, index } = props;
	const targeting = {
		...(selectedFields ? { selectedFields } : {}),
		...(index !== undefined && index !== '' ? { index } : {})
	};
	if (path) {
		return {
			authoringBase,
			site,
			path,
			...targeting
		};
	} else {
		let parentPath;
		if (model === models[selectedId]) {
			let parentId = findParentModelId(model.craftercms.id, hierarchyMap, models);
			parentPath = models[parentId].craftercms.path;
		} else {
			parentPath = models[model.craftercms.id].craftercms.path;
		}

		return {
			authoringBase,
			site,
			path: parentPath,
			isHidden: true,
			modelId: selectedId,
			...targeting
		};
	}
};

const translations = defineMessages({
	openComponentForm: {
		id: 'previewEditFormTool.openComponentForm',
		defaultMessage: 'Edit'
	},
	editTemplate: {
		id: 'previewEditFormTool.editTemplate',
		defaultMessage: 'Edit Template'
	},
	editController: {
		id: 'previewEditFormTool.editController',
		defaultMessage: 'Edit Controller'
	}
});

export function EditFormPanel(props: EditFormPanelProps) {
	const { showToolsPanel, guest } = usePreviewState();
	const { selected, models, hierarchyMap, modelIdByPath } = guest ?? {};
	const getAnchorPosition = () => {
		let iframe = document.getElementById('crafterCMSPreviewIframe');
		let bounding = iframe.getBoundingClientRect();
		let selection = selected[0];
		return {
			top: bounding.top + selection.coordinates.y,
			left: (showToolsPanel ? bounding.left : 0) + selection.coordinates.x
		};
	};
	return (
		<Menu
			open={props.open && Boolean(selected)}
			onClose={props.onDismiss}
			anchorReference="anchorPosition"
			anchorPosition={props.open ? getAnchorPosition() : null}
		>
			<div>
				{selected ? (
					<EditFormPanelBody
						models={models}
						selected={selected}
						hierarchyMap={hierarchyMap}
						modelIdByPath={modelIdByPath}
						onDismiss={props.onDismiss}
					/>
				) : (
					''
				)}
			</div>
		</Menu>
	);
}

function EditFormPanelBody(props: EditFormPanelBodyProps) {
	const { onDismiss, selected, models, modelIdByPath, hierarchyMap } = props;
	const dispatch = useDispatch();
	const contentTypesBranch = useSelection((state) => state.contentTypes);
	const site = useActiveSiteId();
	const { formatMessage } = useIntl();
	const authoringBase = useSelection<string>((state) => state.env.authoringBase);

	const item = selected[0];
	const fieldId = item.fieldId[0];
	let model = models[item.modelId];
	let contentType = contentTypesBranch.byId[model.craftercms.contentTypeId];
	const levelDescriptorPath = model.craftercms.sourceMap?.[fieldId];
	if (levelDescriptorPath) {
		// Is inherited field
		const modelId = modelIdByPath[levelDescriptorPath];
		model = models[modelId];
		contentType = contentTypesBranch.byId[model.craftercms.contentTypeId];
	}

	const field = fieldId ? getField(contentType, fieldId) : null;
	let title;
	let selectedId;

	if (nnou(field)) {
		if (field.type === 'node-selector' && nnou(item.index)) {
			let component;
			if (nnou(fieldId) && fieldId.includes('.')) {
				const aux = ModelHelper.extractCollectionItem(model, fieldId, item.index);
				component = models[aux];
			} else {
				const id = ModelHelper.value(model, fieldId)[item.index];
				component = models[id];
			}
			if (component) {
				selectedId = component.craftercms.id;
				title = `${component.craftercms.label} (${contentType.name})`;
			} else {
				selectedId = item.modelId;
				title = `${field.name} (${contentType.name})`;
			}
		} else {
			selectedId = item.modelId;
			title = `${field.name} (${contentType.name})`;
		}
	} else {
		selectedId = item.modelId;
		title = `${model.craftercms.label} (${contentType.name})`;
	}

	const path = ModelHelper.prop(models[selectedId], 'path');
	const selectedContentTypeId = contentType.id;

	function openDialog(type: string) {
		onDismiss();
		if (type === 'form') {
			const selection = selected[0];
			const selectedFields = selection?.fieldId.length ? selection.fieldId : null;
			dispatch(
				pickShowContentFormAction(
					getEditDialogProps({
						authoringBase,
						hierarchyMap,
						model,
						models,
						path,
						selectedFields,
						selectedId,
						site,
						index: selection?.index
					})
				)
			);
		} else {
			const dialogId = nanoid();
			dispatch(
				pushDialog({
					id: dialogId,
					component: createComponentId('CodeEditorDialog'),
					props: {
						path:
							type === 'template'
								? contentType.displayTemplate
								: `/scripts/pages/${popPiece(selectedContentTypeId, '/')}.groovy`,
						contentType: selectedContentTypeId,
						mode: type === 'template' ? 'ftl' : 'groovy',
						onClose: () => dispatch(popCodeEditorDialog({ id: dialogId }))
					}
				})
			);
		}
	}

	if (selected.length > 1) {
		// TODO: Implement Multi-mode...
		return (
			<>
				<ToolPanel BackIcon={CloseRounded} title="Not Implemented.">
					<Typography>This condition is not implemented yet.</Typography>
				</ToolPanel>
			</>
		);
	}

	return (
		<>
			<Typography variant="caption" style={{ padding: '0 16px 5px' }} component="p">
				{title}
			</Typography>
			<MenuItem onClick={() => openDialog('form')}>{formatMessage(translations.openComponentForm)}</MenuItem>
			<MenuItem onClick={() => openDialog('template')}>{formatMessage(translations.editTemplate)}</MenuItem>
			{/* TODO: should use type instead of content type id string inspection */}
			{selectedContentTypeId.includes('/page') && (
				<MenuItem onClick={() => openDialog('controller')}>{formatMessage(translations.editController)}</MenuItem>
			)}
		</>
	);
}

export default EditFormPanel;
