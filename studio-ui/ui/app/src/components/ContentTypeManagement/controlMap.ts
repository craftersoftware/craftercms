/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
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

import { type ElementType, lazy } from 'react';

export type DescriptorControlType =
	| 'content-path-input'
	| 'contentTypes'
	| 'dropdown-static-values'
	| 'template-selector'
	| 'type-image-selector'
	| 'read-only-value'
	| 'range'
	| 'type-controller-selector'
	| 'key-value-map'
	| 'type-destination-paths-selector'
	| 'path-with-macro-creator'
	| 'merge-strategy-selector'
	| 'variable'
	| 'datasource:image'
	| 'datasource:video'
	| 'datasource:audio'
	| 'datasource:item'
	| 'datasource:transcoded-video'
	| 'datasource:image:singleSelection'
	| 'datasource:video:singleSelection'
	| 'datasource:audio:singleSelection'
	| 'datasource:item:singleSelection'
	| 'boolean'
	| 'int'
	| 'string'
	| 'date-time-expression-input'
	| 'rte'
	| 'delete-dependencies'
	| 'copy-dependencies'
	| 'sort-dropdown';

const DataSourceMultiSelector = lazy(() => import('./controls/DataSourceMultiSelector'));
const DataSourceSingleSelector = lazy(() => import('./controls/DataSourceSingleSelector'));

export const controlMap: Record<DescriptorControlType, ElementType> = {
	'content-path-input': lazy(() => import('./controls/ContentPathInput')),
	contentTypes: lazy(() => import('./controls/ContentTypesSelector')),
	'dropdown-static-values': lazy(() => import('./controls/DropdownStaticValues')),
	'template-selector': lazy(() => import('./controls/TemplateSelector')),
	'type-image-selector': lazy(() => import('./controls/TypeImageSelector')),
	'datasource:image': DataSourceMultiSelector,
	'datasource:video': DataSourceMultiSelector,
	'datasource:audio': DataSourceMultiSelector,
	'datasource:item': DataSourceMultiSelector,
	'datasource:transcoded-video': DataSourceMultiSelector,
	'datasource:image:singleSelection': DataSourceSingleSelector,
	'datasource:video:singleSelection': DataSourceSingleSelector,
	'datasource:audio:singleSelection': DataSourceSingleSelector,
	'datasource:item:singleSelection': DataSourceSingleSelector,
	'read-only-value': lazy(() => import('./controls/ReadOnlyValue')),
	range: lazy(() => import('./controls/Range')),
	'type-controller-selector': lazy(() => import('./controls/TypeControllerSelector')),
	'key-value-map': lazy(() => import('./controls/KeyValueMap')),
	'type-destination-paths-selector': lazy(() => import('./controls/TypeDestinationPathsSelector')),
	'path-with-macro-creator': lazy(() => import('./controls/PathWithMacroCreator')),
	'merge-strategy-selector': lazy(() => import('./controls/MergeStrategySelector')),
	variable: lazy(() => import('./controls/Variable')),
	boolean: lazy(() => import('../FormsEngine/controls/Checkbox')),
	int: lazy(() => import('../FormsEngine/controls/Numeric')),
	string: lazy(() => import('../FormsEngine/controls/Text')),
	'date-time-expression-input': lazy(() => import('./controls/DateTimeExpressionInput')),
	rte: lazy(() => import('./controls/RichTextEditor')),
	'delete-dependencies': lazy(() => import('./controls/DeleteDependencies')),
	'copy-dependencies': lazy(() => import('./controls/CopyDependencies')),
	'sort-dropdown': lazy(() => import('./controls/SortDropdown'))
};
