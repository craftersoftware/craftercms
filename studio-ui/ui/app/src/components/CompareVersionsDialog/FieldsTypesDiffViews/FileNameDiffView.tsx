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

import React from 'react';
import { DiffViewComponentBaseProps } from '../utils';
import { MonacoDiffEditorProps } from '../../MonacoEditor';
import { fromString } from '../../../utils/xml';
import { getContentFileNameFromPath } from '../../../utils/content';
import TextDiffView from './TextDiffView';
import { XmlKeys } from '../../FormsEngine/lib/formConsts';

export interface FileNameDiffViewProps extends Pick<DiffViewComponentBaseProps, 'aXml' | 'bXml'> {
	editorProps?: MonacoDiffEditorProps;
}

export function FileNameDiffView(props: FileNameDiffViewProps) {
	const { aXml, bXml, editorProps } = props;
	// Default values in case of parsing issues
	let fileNameA = '';
	let fileNameB = '';
	try {
		const pathA = fromString(aXml).querySelector(XmlKeys.fileName).textContent;
		fileNameA = getContentFileNameFromPath(pathA);
	} catch (error) {
		console.error('Error parsing file name from A XML:', error);
	}
	try {
		const pathB = fromString(bXml).querySelector(XmlKeys.fileName).textContent;
		fileNameB = getContentFileNameFromPath(pathB);
	} catch (error) {
		console.error('Error parsing file name from B XML:', error);
	}

	return <TextDiffView aXml={fileNameA} bXml={fileNameB} editorProps={editorProps} />;
}

export default FileNameDiffView;
