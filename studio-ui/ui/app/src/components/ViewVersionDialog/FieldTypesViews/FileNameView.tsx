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
import { ViewComponentBaseProps } from '../utils';
import { MonacoEditorProps } from '../../MonacoEditor';
import { fromString } from '../../../utils/xml';
import { getContentFileNameFromPath } from '../../../utils/content';
import TextView from './TextView';
import { XmlKeys } from '../../FormsEngine/lib/formConsts';

export interface FileNameViewProps extends Pick<ViewComponentBaseProps, 'xml'> {
	editorProps?: MonacoEditorProps;
}

export function FileNameView(props: FileNameViewProps) {
	const { xml, editorProps } = props;
	if (!xml) {
		return <TextView xml="" editorProps={editorProps} />;
	}

	const xmlDoc = fromString(xml);
	const pathElement = xmlDoc?.querySelector(`${XmlKeys.fileName}`);
	const path = pathElement?.textContent || '';
	const fileName = getContentFileNameFromPath(path);

	return <TextView xml={fileName} editorProps={editorProps} />;
}

export default FileNameView;
