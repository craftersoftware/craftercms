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

import { ContentTypeField, Primitive } from '../../models';
import Box from '@mui/material/Box';
import React, { ElementType } from 'react';
import { fromString, serialize } from '../../utils/xml';
import { nnou } from '../../utils/object';
import { countLines } from '../../utils/string';
import { initialFieldViewState, useVersionsDialogContext } from '../CompareVersionsDialog/VersionsDialogContext';
import DefaultView from './FieldTypesViews/DefaultView';
import ImageView from './FieldTypesViews/ImageView';
import VideoView from './FieldTypesViews/VideoView';
import TimeView from './FieldTypesViews/TimeView';
import DateTimeView from './FieldTypesViews/DateTimeView';
import BooleanView from './FieldTypesViews/BooleanView';
import NodeSelector from './FieldTypesViews/NodeSelector';
import RepeatGroupView from './FieldTypesViews/RepeatGroupView';
import NumberView from './FieldTypesViews/NumberView';
import Typography from '@mui/material/Typography';
import { FormattedMessage } from 'react-intl';
import CheckboxGroupView from './FieldTypesViews/CheckboxGroupView';
import TextView from './FieldTypesViews/TextView';
import { MonacoEditorProps } from '../MonacoEditor';
import { ViewComponentBaseProps } from './utils';
import { getContentInstanceXmlValueFromProp } from '../../utils/content';
import FileNameView from './FieldTypesViews/FileNameView';
import type { BuiltInControlType } from '../FormsEngine/lib/controlMap';

export interface ContentFieldViewProps {
	content: Primitive;
	field: ContentTypeField;
	xml?: string;
	showToolbar?: boolean;
	dynamicHeight?: boolean;
	onSelectField?(field: ContentTypeField): void;
}

export interface ViewComponentProps extends Pick<ViewComponentBaseProps, 'xml' | 'field'> {
	editorProps?: MonacoEditorProps;
}

export const typesViewMap = {
	'file-name': FileNameView,
	'auto-filename': FileNameView,
	textarea: TextView,
	rte: TextView,
	input: TextView,
	'node-selector': NodeSelector,
	'checkbox-group': CheckboxGroupView,
	repeat: RepeatGroupView,
	'image-picker': ImageView,
	'video-picker': VideoView,
	time: TimeView,
	'date-time': DateTimeView,
	checkbox: BooleanView,
	'page-nav-order': BooleanView,
	'numeric-input': NumberView,
	dropdown: TextView
} as Record<Partial<BuiltInControlType>, ElementType>;

export function ContentFieldView(props: ContentFieldViewProps) {
	const { content, field, xml = '', dynamicHeight } = props;
	const fieldXml = getContentInstanceXmlValueFromProp(xml, field.id);
	const [{ fieldsViewState }] = useVersionsDialogContext();
	const viewState = fieldsViewState[field.id] ?? initialFieldViewState;
	const { compareXml: viewXml, monacoOptions } = viewState;
	const monacoEditorHeight = !dynamicHeight ? '100%' : countLines(fieldXml ?? '') < 15 ? '200px' : '600px';
	const ViewComponent = typesViewMap[field.type] ?? DefaultView;
	const viewComponentProps: ViewComponentProps = {
		xml: fieldXml,
		field,
		editorProps: {
			options: monacoOptions,
			height: monacoEditorHeight
		}
	};
	const noContentSet = ViewComponent !== BooleanView && !content;

	return (
		<Box sx={{ flexGrow: 1 }}>
			{viewXml ? (
				<TextView xml={fieldXml} editorProps={viewComponentProps.editorProps} />
			) : nnou(ViewComponent) ? (
				noContentSet ? (
					<Box sx={{ textAlign: 'center' }}>
						<Typography color="textSecondary">
							<FormattedMessage defaultMessage="No content set" />
						</Typography>
					</Box>
				) : (
					<ViewComponent {...viewComponentProps} />
				)
			) : null}
		</Box>
	);
}

export default ContentFieldView;
