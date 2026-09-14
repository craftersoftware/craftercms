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

import { ContentTypeField } from '../../models/ContentType';
import React from 'react';
import Box from '@mui/material/Box';
import { getContentInstanceValueFromProp } from '../../utils/content';
import { fromString, serialize } from '../../utils/xml';
import { DiffViewComponentBaseProps, SelectionContentVersion, typesDiffMap } from './utils';
import ContentFieldView from '../ViewVersionDialog/ContentFieldView';
import { countLines } from '../../utils/string';
import { ErrorBoundary } from '../ErrorBoundary';
import { initialFieldViewState, useVersionsDialogContext } from './VersionsDialogContext';
import DefaultDiffView from './FieldsTypesDiffViews/DefaultDiffView';
import TextDiffView from './FieldsTypesDiffViews/TextDiffView';
import { MonacoDiffEditorProps } from '../MonacoEditor';
import ContentInstance from '../../models/ContentInstance';

export interface CompareFieldPanelProps {
	a: SelectionContentVersion;
	b: SelectionContentVersion;
	field: ContentTypeField;
	dynamicHeight?: boolean;
	onSelectField?(field: ContentTypeField): void;
}

export interface DiffComponentProps extends Pick<DiffViewComponentBaseProps, 'aXml' | 'bXml' | 'field'> {
	editorProps?: MonacoDiffEditorProps;
}

export function CompareFieldPanel(props: CompareFieldPanelProps) {
	const { a, b, field, onSelectField, dynamicHeight } = props;
	const [{ fieldsViewState }] = useVersionsDialogContext();
	const fieldType = field.type;
	const versionAXmlDoc = fromString(a.xml);
	const versionBXmlDoc = fromString(b.xml);
	const versionAFieldDoc =
		versionAXmlDoc.querySelector(`page > ${field.id}`) ??
		versionAXmlDoc.querySelector(`component > ${field.id}`) ??
		versionAXmlDoc.querySelector(`item > ${field.id}`);
	const versionBFieldDoc =
		versionBXmlDoc.querySelector(`page > ${field.id}`) ??
		versionBXmlDoc.querySelector(`component > ${field.id}`) ??
		versionBXmlDoc.querySelector(`item > ${field.id}`);
	const versionAFieldXml = versionAFieldDoc ? serialize(versionAFieldDoc) : '';
	const versionBFieldXml = versionBFieldDoc ? serialize(versionBFieldDoc) : '';
	const unchanged = versionAFieldXml === versionBFieldXml;
	const contentA = getContentInstanceValueFromProp(a.content as ContentInstance, field.id);
	const longerXmlContent = versionAFieldXml.length > versionBFieldXml.length ? versionAFieldXml : versionBFieldXml;
	const monacoEditorHeight = dynamicHeight ? (countLines(longerXmlContent) < 15 ? '200px' : '600px') : '100%';
	const DiffComponent = typesDiffMap[fieldType] ?? DefaultDiffView;
	const viewState = fieldsViewState[field.id] ?? initialFieldViewState;
	const { compareXml, monacoOptions } = viewState;
	const diffComponentProps: DiffComponentProps = {
		aXml: versionAFieldXml,
		bXml: versionBFieldXml,
		field,
		editorProps: { options: monacoOptions, height: monacoEditorHeight }
	};

	return (
		<Box height="calc(100% - 70px)" display="flex" flexDirection="column">
			{unchanged ? (
				<ContentFieldView
					content={contentA}
					field={field}
					xml={a.xml}
					onSelectField={onSelectField}
					dynamicHeight={dynamicHeight}
				/>
			) : (
				<>
					{compareXml ? (
						<TextDiffView
							aXml={versionAFieldXml}
							bXml={versionBFieldXml}
							editorProps={diffComponentProps.editorProps}
						/>
					) : (
						<ErrorBoundary key={field.id}>
							<DiffComponent {...diffComponentProps} />
						</ErrorBoundary>
					)}
				</>
			)}
		</Box>
	);
}

export default CompareFieldPanel;
